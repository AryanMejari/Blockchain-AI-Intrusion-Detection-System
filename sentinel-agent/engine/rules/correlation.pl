:- module(correlation, [
    events_by_user/3,
    events_by_source/3,
    sum_failures_for_user/3,
    distinct_users_for_source/3,
    incident_correlation_key/3
]).

% Group events for a specific user
events_by_user(Facts, User, UserEvents) :-
    findall(Fact, (
        member(Fact, Facts),
        ( Fact = failed_login(User, _, _)
        ; Fact = failed_login_src(User, _, _, _, _)
        ; Fact = successful_login(User, _, _)
        ; Fact = successful_login_src(User, _, _, _, _)
        ; Fact = sensitive_access(User, _, _)
        ; Fact = privilege_change(User, _)
        ; Fact = unusual_process(User, _, _)
        )
    ), UserEvents).

% Group events for a specific source IP / identifier
events_by_source(Facts, Source, SourceEvents) :-
    Source \== 'unknown_source', Source \== '',
    findall(Fact, (
        member(Fact, Facts),
        ( Fact = failed_login_src(_, _, Source, _, _)
        ; Fact = successful_login_src(_, _, Source, _, _)
        ; Fact = rate_limit_event(Source, _, _)
        ; Fact = invalid_request(_, Source, _)
        )
    ), SourceEvents).

% Sum failed attempts for a given user across facts
sum_failures_for_user(Facts, User, TotalFailures) :-
    findall(Count, (
        member(Fact, Facts),
        ( Fact = failed_login(User, Count, _)
        ; Fact = failed_login_src(User, Count, _, _, _)
        )
    ), Counts),
    sum_list(Counts, TotalFailures).

% Find distinct users targeted by a single source
distinct_users_for_source(Facts, Source, Users) :-
    Source \== 'unknown_source', Source \== '',
    findall(User, (
        member(Fact, Facts),
        ( Fact = failed_login_src(User, _, Source, _, _)
        ; Fact = invalid_request(User, Source, _)
        )
    ), AllUsers),
    sort(AllUsers, Users).

% Stable incident correlation key based on threat type and primary subject
incident_correlation_key(Type, Subject, Key) :-
    format(atom(Key), 'inc_~w_~w', [Type, Subject]).
