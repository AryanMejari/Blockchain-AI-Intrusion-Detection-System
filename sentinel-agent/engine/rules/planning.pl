:- module(planning, [
    plan_action/3
]).

% Select read-only investigation actions based on hypotheses
plan_action(Hypotheses, _Facts, Action) :-
    member(H, Hypotheses), H.type == elevated_post_compromise_threat,
    Action = _{id:isolate_session_simulation, priority:1, target:H.subject,
               title:"Initiate containment review",
               reason:"High confidence compromise with elevated activity. Review active sessions, token issuance, and parent process lineage.",
               mode:"read_only_simulation"}.

plan_action(Hypotheses, _Facts, Action) :-
    member(H, Hypotheses), H.type == account_compromise_suspected,
    Action = _{id:verify_login_context, priority:1, target:H.subject,
               title:"Verify login context",
               reason:"Confirm source, device, and expected activity for the login that followed repeated failures.",
               mode:"read_only_simulation"}.

plan_action(Hypotheses, _Facts, Action) :-
    member(H, Hypotheses), (H.type == account_compromise_suspected ; H.type == brute_force_attack_suspected),
    Action = _{id:review_authentication_history, priority:2, target:H.subject,
               title:"Review authentication history",
               reason:"Check whether failures share a common source IP and whether MFA challenge was satisfied.",
               mode:"read_only_simulation"}.

plan_action(Hypotheses, _Facts, Action) :-
    member(H, Hypotheses), H.type == credential_spray_suspected,
    Action = _{id:inspect_source_reputation, priority:2, target:H.subject,
               title:"Analyze source telemetry",
               reason:"Source IP attempted credential guessing across multiple accounts. Inspect source subnet and threat intel reputation.",
               mode:"read_only_simulation"}.

plan_action(Hypotheses, _Facts, Action) :-
    member(H, Hypotheses), H.type == rate_limit_exceeded,
    Action = _{id:inspect_traffic_burst, priority:3, target:H.subject,
               title:"Inspect traffic burst profile",
               reason:"Examine user agent, request frequency, and URI distribution for automated script tooling.",
               mode:"read_only_simulation"}.

plan_action(Hypotheses, _Facts, Action) :-
    member(H, Hypotheses), H.type == possible_sensitive_data_access,
    Action = _{id:validate_resource_access, priority:3, target:H.subject,
               title:"Validate sensitive-resource access",
               reason:"Check authorization and whether accessed resource matches user role and baseline profile.",
               mode:"read_only_simulation"}.

plan_action(Hypotheses, _Facts, Action) :-
    member(H, Hypotheses), H.type == possible_post_compromise_activity,
    Action = _{id:inspect_process_metadata, priority:4, target:H.subject,
               title:"Inspect process metadata",
               reason:"Validate executable path, digital signature, parent process ID, and authorized change ticket.",
               mode:"read_only_simulation"}.

plan_action(Hypotheses, _Facts, Action) :-
    member(H, Hypotheses), H.type == benign_authentication_pattern,
    Action = _{id:log_baseline_verification, priority:5, target:H.subject,
               title:"Log baseline observation",
               reason:"Activity matches normal typo recovery. No elevated action required; telemetry retained in baseline ledger.",
               mode:"read_only_simulation"}.

plan_action([], _Facts, Action) :-
    Action = _{id:collect_more_evidence, priority:5, target:system,
               title:"Collect more evidence",
               reason:"No rule threshold was met. Collect endpoint and authentication context before drawing conclusions.",
               mode:"read_only_simulation"}.
