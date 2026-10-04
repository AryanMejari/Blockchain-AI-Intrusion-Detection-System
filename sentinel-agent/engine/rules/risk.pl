:- module(risk, [
    hypothesis_severity/2,
    hypothesis_risk_score/2
]).

hypothesis_severity(elevated_post_compromise_threat, critical).
hypothesis_severity(account_compromise_suspected, critical).
hypothesis_severity(brute_force_attack_suspected, high).
hypothesis_severity(credential_spray_suspected, high).
hypothesis_severity(rate_limit_exceeded, medium).
hypothesis_severity(suspicious_login_context, medium).
hypothesis_severity(possible_sensitive_data_access, medium).
hypothesis_severity(possible_post_compromise_activity, medium).
hypothesis_severity(benign_authentication_pattern, low).
hypothesis_severity(_, low).

hypothesis_risk_score(elevated_post_compromise_threat, 95).
hypothesis_risk_score(account_compromise_suspected, 85).
hypothesis_risk_score(brute_force_attack_suspected, 70).
hypothesis_risk_score(credential_spray_suspected, 75).
hypothesis_risk_score(rate_limit_exceeded, 55).
hypothesis_risk_score(suspicious_login_context, 50).
hypothesis_risk_score(possible_sensitive_data_access, 60).
hypothesis_risk_score(possible_post_compromise_activity, 65).
hypothesis_risk_score(benign_authentication_pattern, 10).
hypothesis_risk_score(_, 20).
