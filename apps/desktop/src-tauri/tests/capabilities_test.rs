#![allow(clippy::expect_used)]

#[test]
fn close_request_handler_can_destroy_the_window() {
    let capability: serde_json::Value =
        serde_json::from_str(include_str!("../capabilities/default.json"))
            .expect("default Tauri capability should be valid JSON");
    let permissions = capability["permissions"]
        .as_array()
        .expect("default capability should declare permissions");

    assert!(permissions
        .iter()
        .any(|permission| { permission.as_str() == Some("core:window:allow-destroy") }));
}
