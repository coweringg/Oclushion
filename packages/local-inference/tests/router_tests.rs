use local_inference::inference::router::{InferenceRouter, RouteDecision};

#[test]
fn test_autocomplete_routes_local() {
    assert_eq!(InferenceRouter::decide("autocomplete"), RouteDecision::Local);
}

#[test]
fn test_fim_routes_local() {
    assert_eq!(InferenceRouter::decide("fim"), RouteDecision::Local);
}

#[test]
fn test_inline_completion_routes_local() {
    assert_eq!(InferenceRouter::decide("inline-completion"), RouteDecision::Local);
}

#[test]
fn test_chat_routes_cloud() {
    assert_eq!(InferenceRouter::decide("chat"), RouteDecision::Cloud);
}

#[test]
fn test_chat_completion_routes_cloud() {
    assert_eq!(InferenceRouter::decide("chat-completion"), RouteDecision::Cloud);
}

#[test]
fn test_agents_routes_cloud() {
    assert_eq!(InferenceRouter::decide("agents"), RouteDecision::Cloud);
}

#[test]
fn test_secondary_agents_routes_local() {
    assert_eq!(InferenceRouter::decide("secondary_agents"), RouteDecision::Local);
}

#[test]
fn test_secondary_agent_routes_local() {
    assert_eq!(InferenceRouter::decide("secondary-agent"), RouteDecision::Local);
}

#[test]
fn test_embedding_routes_local() {
    assert_eq!(InferenceRouter::decide("embed"), RouteDecision::Local);
}

#[test]
fn test_summarize_routes_cloud() {
    assert_eq!(InferenceRouter::decide("summarize"), RouteDecision::Cloud);
}

#[test]
fn test_unknown_task_defaults_to_cloud() {
    assert_eq!(InferenceRouter::decide("unknown-task"), RouteDecision::Cloud);
}
