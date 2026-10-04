:- module(explanations, [
    hypothesis_explanation/5
]).

hypothesis_explanation(elevated_post_compromise_threat, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'Successful login after repeated failures detected for ~w', [Subject]),
    format(atom(Obs2), 'Elevated sensitive access or process execution observed on ~w session', [Subject]),
    Observed = [Obs1, Obs2],
    Missing = ["Endpoint memory dump", "EDR behavioral parent-child tree", "Admin approval ticket"],
    Alternatives = ["Scheduled administrative maintenance script running under user context", "Authorized security penetration testing"].

hypothesis_explanation(account_compromise_suspected, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'Multiple authentication failures recorded for account ~w', [Subject]),
    Obs2 = 'Successful authentication occurred shortly after the failure sequence',
    Observed = [Obs1, Obs2],
    Missing = ["Multi-factor authentication (MFA) server logs", "Device fingerprint match with user baseline", "Geographic IP consistency"],
    Alternatives = ["User mistyped password repeatedly before successfully recalling it", "Client-side password manager autofill failure prior to manual entry"].

hypothesis_explanation(brute_force_attack_suspected, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'High volume of failed authentication attempts targeting ~w', [Subject]),
    Observed = [Obs1],
    Missing = ["Source IP geolocation and ISP telemetry", "Packet payload analysis for scripted user-agent"],
    Alternatives = ["Expired cached credentials on a local sync client (Outlook, OneDrive, git)", "Third-party API script with stale token"].

hypothesis_explanation(credential_spray_suspected, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'Single source IP ~w submitted logins targeting multiple distinct accounts', [Subject]),
    Observed = [Obs1],
    Missing = ["External proxy / Tor exit node reputation feed", "Shared corporate NAT gateway egress logs"],
    Alternatives = ["Legitimate enterprise proxy or VPN gateway aggregating traffic from multiple coworkers", "University campus WiFi NAT"].

hypothesis_explanation(rate_limit_exceeded, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'High burst request volume from source identifier ~w', [Subject]),
    Observed = [Obs1],
    Missing = ["HTTP header inspection (TLS fingerprint, JA3)", "CAPTCHA response verification"],
    Alternatives = ["Browser tab stuck in rapid auto-refresh loop", "Aggressive automated health-check probe"].

hypothesis_explanation(suspicious_login_context, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'Successful authentication for ~w with unusual time or suspicious source context', [Subject]),
    Observed = [Obs1],
    Missing = ["Historical baseline working hours for user", "User travel advisory or VPN connection state"],
    Alternatives = ["User working overtime, traveling, or on call", "User utilizing new ISP or residential VPN"].

hypothesis_explanation(possible_sensitive_data_access, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'Sensitive resource accessed by ~w following unusual authentication', [Subject]),
    Observed = [Obs1],
    Missing = ["Data classification label validation", "Access control list (ACL) audit log"],
    Alternatives = ["Routine business task requiring financial or administrative documents", "Data backup routine"].

hypothesis_explanation(possible_post_compromise_activity, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'Privilege modification or unusual process execution for ~w', [Subject]),
    Observed = [Obs1],
    Missing = ["Process binary code signature", "Parent process hierarchy", "Change ticket reference"],
    Alternatives = ["Legitimate IT administrator maintenance task", "Software auto-update utility"].

hypothesis_explanation(benign_authentication_pattern, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'Low failure count (1-2 attempts) followed by verified successful login for ~w', [Subject]),
    Observed = [Obs1],
    Missing = ["None. Telemetry is fully consistent with normal human behavior"],
    Alternatives = ["Normal human typo during initial password entry"].

hypothesis_explanation(_, Subject, Observed, Missing, Alternatives) :-
    format(atom(Obs1), 'Event telemetry recorded for subject ~w', [Subject]),
    Observed = [Obs1],
    Missing = ["Corroborating security event telemetry"],
    Alternatives = ["Normal background system telemetry"].
