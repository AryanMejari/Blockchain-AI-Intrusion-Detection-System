:- module(detection, [
    detect_hypotheses/2,
    rule_hypothesis/2
]).

:- use_module(correlation).
:- use_module(risk).

detect_hypotheses(Facts, Hypotheses) :-
    findall(H, rule_hypothesis(Facts, H), H0),
    sort(H0, Hypotheses).

% 1. Elevated post-compromise threat: brute force + login + (sensitive access or privilege change or unusual process)
rule_hypothesis(Facts, H) :-
    member(failed_login(User, Count, FailId), Facts), Count >= 3,
    member(successful_login(User, _, SuccessId), Facts),
    ( member(sensitive_access(User, _Res, ElevId), Facts)
    ; member(privilege_change(User, ElevId), Facts)
    ; member(unusual_process(User, _Proc, ElevId), Facts)
    ),
    format(atom(Hid), 'elevated_post_compromise_~w', [User]),
    H = _{id:Hid, type:elevated_post_compromise_threat,
          subject:User, confidence:high, rule:elevated_post_compromise,
          summary:"Authentication success following repeated failures with subsequent high-privilege operations.",
          evidence:[FailId, SuccessId, ElevId],
          rationale:[
              "Repeated failed logins observed prior to successful sign-in.",
              "Successful authentication achieved.",
              "Subsequent sensitive access, privilege escalation, or unusual process execution detected."
          ]}.

% 2. Account compromise suspected: repeated failures then successful login
rule_hypothesis(Facts, H) :-
    member(failed_login(User, Count, FailId), Facts), Count >= 3,
    member(successful_login(User, Context, SuccessId), Facts),
    \+ ( member(sensitive_access(User, _, _), Facts) ),
    \+ ( member(privilege_change(User, _), Facts) ),
    \+ ( member(unusual_process(User, _, _), Facts) ),
    format(atom(Hid), 'brute_force_then_login_~w', [User]),
    ( Context == unusual_time ->
        Summary = "Repeated login failures followed by a successful login at an unusual time."
    ;
        Summary = "Repeated login failures followed by a successful login."
    ),
    H = _{id:Hid, type:account_compromise_suspected,
          subject:User, confidence:high, rule:brute_force_then_success,
          summary:Summary,
          evidence:[FailId, SuccessId],
          rationale:[
              "At least three failed logins were reported before access succeeded.",
              "Authentication succeeded, presenting elevated risk of credential compromise."
          ]}.

% 3. Multiple account targeting / Credential Spray from single source
rule_hypothesis(Facts, H) :-
    findall(S, (member(failed_login_src(_, _, S, _, _), Facts), S \== 'unknown_source', S \== ''), Sources0),
    sort(Sources0, Sources),
    member(Source, Sources),
    distinct_users_for_source(Facts, Source, Users),
    length(Users, UserCount), UserCount >= 2,
    format(atom(Hid), 'credential_spray_~w', [Source]),
    findall(Id, (member(F, Facts), (F = failed_login_src(_, _, Source, _, Id) ; F = invalid_request(_, Source, Id))), Evidence0),
    sort(Evidence0, Evidence),
    format(atom(Summ), 'Simulated credential spray from ~w targeting ~w synthetic accounts.', [Source, UserCount]),
    H = _{id:Hid, type:credential_spray_suspected,
          subject:Source, confidence:high, rule:credential_spray_from_source,
          summary:Summ,
          evidence:Evidence,
          rationale:[
              "Single source address attempted authentications across multiple distinct usernames.",
              "Pattern characteristic of automated password guessing or spraying dictionary attacks."
          ]}.

% 4. Repeated failures against single account without success (Brute Force in progress)
rule_hypothesis(Facts, H) :-
    ( member(failed_login(User, Count, FailId), Facts), Count >= 5
    ; member(failed_login_src(User, Count, _, _, FailId), Facts), Count >= 5
    ),
    \+ member(successful_login(User, _, _), Facts),
    \+ member(successful_login_src(User, _, _, _, _), Facts),
    format(atom(Hid), 'brute_force_failures_~w', [User]),
    H = _{id:Hid, type:brute_force_attack_suspected,
          subject:User, confidence:high, rule:repeated_failed_logins,
          summary:"High volume of consecutive failed authentications targeting account.",
          evidence:[FailId],
          rationale:[
              "Failed attempt counter reached or exceeded critical threshold (>= 5).",
              "No subsequent legitimate authentication observed."
          ]}.

% 5. Rate limit burst exceeded
rule_hypothesis(Facts, H) :-
    ( member(rate_limit_event(Source, _BurstCount, EvtId), Facts)
    ; ( member(failed_login_src(_, _, Source, _, EvtId), Facts),
        events_by_source(Facts, Source, Evts), length(Evts, BurstCount), BurstCount >= 10
      )
    ),
    Source \== 'unknown_source', Source \== '',
    format(atom(Hid), 'rate_limit_exceeded_~w', [Source]),
    H = _{id:Hid, type:rate_limit_exceeded,
          subject:Source, confidence:high, rule:rate_limit_burst_threshold,
          summary:"Request velocity exceeded rate-limiting security threshold.",
          evidence:[EvtId],
          rationale:[
              "Abnormal request density detected over short time interval.",
              "Automated client script or aggressive tool suspected."
          ]}.

% 6. Unusual login context (unusual time or suspicious source) without prior failures
rule_hypothesis(Facts, H) :-
    member(successful_login(User, Context, SuccessId), Facts),
    ( Context == unusual_time ; Context == suspicious_source ),
    \+ member(failed_login(User, _, _), Facts),
    \+ member(failed_login_src(User, _, _, _, _), Facts),
    format(atom(Hid), 'suspicious_login_context_~w', [User]),
    H = _{id:Hid, type:suspicious_login_context,
          subject:User, confidence:medium, rule:anomalous_login_context,
          summary:"Successful sign-in observed under anomalous temporal or network context.",
          evidence:[SuccessId],
          rationale:[
              "Sign-in occurred outside normal operational baseline context.",
              "No brute force was observed; anomaly may reflect off-hours activity or proxy usage."
          ]}.

% 7. Possible sensitive data access after unusual login
rule_hypothesis(Facts, H) :-
    member(successful_login(User, unusual_time, SuccessId), Facts),
    member(sensitive_access(User, _Resource, AccessId), Facts),
    format(atom(Hid), 'unusual_login_sensitive_access_~w', [User]),
    H = _{id:Hid, type:possible_sensitive_data_access,
          subject:User, confidence:medium, rule:sensitive_access_after_unusual_login,
          summary:"An unusual-time login and sensitive-resource access share the same user.",
          evidence:[SuccessId, AccessId],
          rationale:[
              "An unusual-time successful login was observed.",
              "The same user accessed a sensitive resource.",
              "Correlation alone does not prove malicious intent."
          ]}.

% 8. Possible post-compromise activity (privilege change + unusual process)
rule_hypothesis(Facts, H) :-
    member(privilege_change(User, PrivId), Facts),
    member(unusual_process(User, _Process, ProcId), Facts),
    format(atom(Hid), 'privilege_change_and_process_~w', [User]),
    H = _{id:Hid, type:possible_post_compromise_activity,
          subject:User, confidence:medium, rule:privilege_change_and_process,
          summary:"A privilege change and unusual process were observed for the same user.",
          evidence:[PrivId, ProcId],
          rationale:[
              "A privilege change was reported.",
              "An unusual process was reported for the same user.",
              "Validate the process and authorization context before escalation."
          ]}.

% 9. Benign authentication pattern (isolated typo failure followed by normal success)
rule_hypothesis(Facts, H) :-
    member(failed_login(User, Count, FailId), Facts), Count =< 2,
    member(successful_login(User, usual, SuccessId), Facts),
    \+ ( member(failed_login(User, BigCount, _), Facts), BigCount >= 3 ),
    \+ member(sensitive_access(User, _, _), Facts),
    \+ member(privilege_change(User, _), Facts),
    \+ member(unusual_process(User, _, _), Facts),
    format(atom(Hid), 'benign_pattern_~w', [User]),
    H = _{id:Hid, type:benign_authentication_pattern,
          subject:User, confidence:high, rule:benign_typo_recovery,
          summary:"Minor authentication failure followed by verified standard login.",
          evidence:[FailId, SuccessId],
          rationale:[
              "Failure count is within typical human typing error tolerance (<= 2).",
              "Subsequent login verified under normal operational context.",
              "No suspicious follow-on actions or privilege modifications observed."
          ]}.
