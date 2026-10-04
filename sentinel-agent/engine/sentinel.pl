:- use_module(library(http/json)).
:- use_module(library(lists)).
:- use_module(library(apply)).

:- use_module('rules/correlation.pl').
:- use_module('rules/risk.pl').
:- use_module('rules/planning.pl').
:- use_module('rules/explanations.pl').
:- use_module('rules/detection.pl').

% Sentinel: explainable rule-based security reasoning engine.
% Input: JSON on stdin. Output: JSON on stdout.
% Distinguishes raw telemetry from logical inferences.

main :-
    set_stream(user_output, encoding(utf8)),
    read_line_to_string(user_input, Line),
    ( Line == end_of_file -> halt(0)
    ; catch(atom_json_dict(Line, Input, [value_string_as(atom)]), E,
            (print_message(error, E), halt(2))),
      analyze(Input, Output),
      json_write_dict(current_output, Output, [width(0)]), nl,
      halt(0)
    ).

analyze(Input, Output) :-
    Events = Input.get(events),
    ( is_list(Events) -> true ; Events = [] ),
    findall(Fact, (member(E, Events), event_fact(E, Fact)), Facts0),
    sort(Facts0, Facts),
    detect_hypotheses(Facts, Hypotheses),
    build_alerts(Hypotheses, Facts, Alerts),
    choose_plan(Hypotheses, Facts, Plan),
    maplist(event_summary, Events, EventSummaries),
    length(Events, EventCount),
    Output = _{status:ok, event_count:EventCount, events:EventSummaries,
               hypotheses:Hypotheses, alerts:Alerts, next_actions:Plan,
               engine:"SWI-Prolog", safety:"simulation_only"}.

% Map JSON event dictionaries to symbolic facts
event_fact(E, failed_login(User, Count, Id)) :-
    get_dict(type, E, failed_login),
    get_dict(user, E, User),
    get_dict(id, E, Id),
    ( get_dict(count, E, C), integer(C), C >= 0 -> Count = C ; Count = 1 ).

event_fact(E, failed_login_src(User, Count, Source, Timestamp, Id)) :-
    get_dict(type, E, failed_login),
    get_dict(user, E, User),
    get_dict(id, E, Id),
    ( get_dict(source, E, S), S \== '' -> Source = S ; Source = 'unknown_source' ),
    ( get_dict(timestamp, E, T) -> Timestamp = T ; Timestamp = 'unknown_time' ),
    ( get_dict(count, E, C), integer(C), C >= 0 -> Count = C ; Count = 1 ).

event_fact(E, successful_login(User, Context, Id)) :-
    get_dict(type, E, successful_login),
    get_dict(user, E, User),
    get_dict(id, E, Id),
    ( get_dict(context, E, C), C \== '' -> Context = C ; Context = usual ).

event_fact(E, successful_login_src(User, Context, Source, Timestamp, Id)) :-
    get_dict(type, E, successful_login),
    get_dict(user, E, User),
    get_dict(id, E, Id),
    ( get_dict(context, E, C), C \== '' -> Context = C ; Context = usual ),
    ( get_dict(source, E, S), S \== '' -> Source = S ; Source = 'unknown_source' ),
    ( get_dict(timestamp, E, T) -> Timestamp = T ; Timestamp = 'unknown_time' ).

event_fact(E, sensitive_access(User, Resource, Id)) :-
    get_dict(type, E, sensitive_access),
    get_dict(user, E, User),
    get_dict(id, E, Id),
    ( get_dict(resource, E, R) -> Resource = R ; Resource = 'unknown_resource' ).

event_fact(E, privilege_change(User, Id)) :-
    get_dict(type, E, privilege_change),
    get_dict(user, E, User),
    get_dict(id, E, Id).

event_fact(E, unusual_process(User, Process, Id)) :-
    get_dict(type, E, unusual_process),
    get_dict(user, E, User),
    get_dict(id, E, Id),
    ( get_dict(process, E, P) -> Process = P ; Process = 'unknown_process' ).

event_fact(E, invalid_request(User, Source, Id)) :-
    get_dict(type, E, invalid_request),
    get_dict(id, E, Id),
    ( get_dict(user, E, U) -> User = U ; User = 'unknown_user' ),
    ( get_dict(source, E, S) -> Source = S ; Source = 'unknown_source' ).

event_fact(E, rate_limit_event(Source, Count, Id)) :-
    get_dict(type, E, rate_limit_event),
    get_dict(id, E, Id),
    ( get_dict(source, E, S) -> Source = S ; Source = 'unknown_source' ),
    ( get_dict(count, E, C), integer(C) -> Count = C ; Count = 1 ).

event_fact(E, account_lockout(User, Source, Id)) :-
    get_dict(type, E, account_lockout),
    get_dict(id, E, Id),
    ( get_dict(user, E, U) -> User = U ; User = 'unknown_user' ),
    ( get_dict(source, E, S) -> Source = S ; Source = 'unknown_source' ).

event_summary(E, Summary) :-
    ( get_dict(user, E, U) -> User = U ; User = "unknown" ),
    ( get_dict(detail, E, D) -> Detail = D ; Detail = "" ),
    ( get_dict(source, E, S) -> Source = S ; Source = "unknown" ),
    Summary = _{id:E.id, type:E.type, timestamp:E.timestamp,
                user:User, source:Source, detail:Detail}.

build_alerts(Hypotheses, Facts, Alerts) :-
    maplist(alert_from_hypothesis(Facts), Hypotheses, Alerts).

alert_from_hypothesis(_Facts, H, Alert) :-
    length(H.evidence, EvidenceCount),
    hypothesis_severity(H.type, Severity),
    hypothesis_risk_score(H.type, RiskScore),
    hypothesis_explanation(H.type, H.subject, Observed, Missing, Alternatives),
    ( get_dict(rule, H, R) -> RuleName = R ; RuleName = H.type ),
    format_alert_title(H.type, Title),
    ( plan_action([H], [], Action) -> RecAction = Action ; RecAction = _{title:"Review incident", reason:"Investigate relevant audit logs"} ),
    Alert = _{id:H.id, severity:Severity, risk_score:RiskScore,
              title:Title, subject:H.subject,
              confidence:H.confidence, summary:H.summary, evidence:H.evidence,
              evidence_count:EvidenceCount, rationale:H.rationale,
              rule:RuleName, status:"new",
              observed_facts:Observed,
              inferred_facts:[H.summary],
              missing_evidence:Missing,
              alternative_explanations:Alternatives,
              recommended_action:RecAction}.

format_alert_title(elevated_post_compromise_threat, "Elevated Post-Compromise Activity") :- !.
format_alert_title(account_compromise_suspected, "account_compromise_suspected") :- !.
format_alert_title(brute_force_attack_suspected, "Repeated Authentication Failures") :- !.
format_alert_title(credential_spray_suspected, "Credential Spray Across Multiple Accounts") :- !.
format_alert_title(rate_limit_exceeded, "Rate-Limit Threshold Exceeded") :- !.
format_alert_title(suspicious_login_context, "Suspicious Login Context") :- !.
format_alert_title(possible_sensitive_data_access, "possible_sensitive_data_access") :- !.
format_alert_title(possible_post_compromise_activity, "possible_post_compromise_activity") :- !.
format_alert_title(benign_authentication_pattern, "Benign Authentication Sequence") :- !.
format_alert_title(Type, Title) :- atom_string(Type, Title).

choose_plan(Hypotheses, Facts, Plan) :-
    findall(A, plan_action(Hypotheses, Facts, A), A0),
    sort(A0, Plan).

len(List, Length) :- length(List, Length).

:- initialization(main, main).
