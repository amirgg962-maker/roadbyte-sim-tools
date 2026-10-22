use regex::Regex;
use std::sync::LazyLock;

use crate::save_parser::error::SaveError;

pub const MAX_ARRAY_ITEMS: usize = 10_000;

#[allow(clippy::expect_used)]
static PROPERTY_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^\s*(?P<name>\w+(?:\[\d+\])?)\s*:\s*(?P<value>.+?)\s*$")
        .expect("invalid regex pattern")
});

pub struct SiiDocument {
    content: String,
}

impl SiiDocument {
    pub fn new(content: String) -> Self {
        Self { content }
    }

    pub fn content(&self) -> &str {
        &self.content
    }

    pub fn get_property(&self, property_name: &str) -> Option<&str> {
        let escaped = regex::escape(property_name);
        let pattern = format!(r"(?m)^\s*{}\s*:\s*(.+?)\s*$", escaped);
        let re = Regex::new(&pattern).ok()?;
        let cap = re.captures(&self.content)?;
        Some(cap.get(1)?.as_str())
    }

    pub fn set_property(
        &mut self,
        property_name: &str,
        new_value: &str,
    ) -> Result<bool, SaveError> {
        let escaped = regex::escape(property_name);
        let pattern = format!(
            r"(?m)(^[ \t]*{}[ \t]*:[ \t]*)([^\r\n]*?)([ \t]*\r?$)",
            escaped
        );
        let re = Regex::new(&pattern)?;
        let replacement = format!("${{1}}{new_value}${{3}}");
        let new_content = re.replace_all(&self.content, replacement.as_str());
        let changed = new_content != self.content;
        self.content = new_content.into_owned();
        Ok(changed)
    }

    pub fn get_array_property(&self, property_name: &str) -> Result<Vec<String>, SaveError> {
        let count = match self.get_property(property_name) {
            Some(val) => val.parse::<usize>().map_err(|_| {
                SaveError::Compression(format!("Invalid array count for {property_name}"))
            })?,
            None => return Ok(Vec::new()),
        };
        if count > MAX_ARRAY_ITEMS {
            return Err(SaveError::Compression(format!(
                "Array {property_name} exceeds the {MAX_ARRAY_ITEMS} item safety limit"
            )));
        }

        let mut items = Vec::with_capacity(count);
        for i in 0..count {
            let indexed_name = format!("{}[{}]", property_name, i);
            match self.get_property(&indexed_name) {
                Some(val) => items.push(val.to_string()),
                None => items.push(String::new()),
            }
        }
        Ok(items)
    }

    pub fn set_array_property(
        &mut self,
        property_name: &str,
        values: &[String],
    ) -> Result<bool, SaveError> {
        if values.len() > MAX_ARRAY_ITEMS {
            return Err(SaveError::Compression(format!(
                "Array {property_name} exceeds the {MAX_ARRAY_ITEMS} item safety limit"
            )));
        }
        let mut changed = false;

        let count = values.len().to_string();
        if self.get_property(property_name).is_some() {
            if self.set_property(property_name, &count)? {
                changed = true;
            }
        } else {
            self.insert_property(property_name, &count);
            changed = true;
        }

        for (i, value) in values.iter().enumerate() {
            let indexed_name = format!("{}[{}]", property_name, i);
            if self.get_property(&indexed_name).is_some() {
                if self.set_property(&indexed_name, value)? {
                    changed = true;
                }
            } else {
                self.insert_property(&indexed_name, value);
                changed = true;
            }
        }

        Ok(changed)
    }

    fn insert_property(&mut self, name: &str, value: &str) {
        let base_name = name.split_once('[').map_or(name, |(base, _)| base);
        let property_pattern = format!(r"(?m)^\s*{}(?:\[\d+\])?\s*:", regex::escape(base_name));
        let property_re = Regex::new(&property_pattern).ok();
        let insertion_point = property_re
            .and_then(|re| re.find_iter(&self.content).last())
            .map_or_else(
                || self.content.rfind('}').unwrap_or(self.content.len()),
                |matched| {
                    self.content[matched.start()..]
                        .find('\n')
                        .map_or(self.content.len(), |newline| matched.start() + newline + 1)
                },
            );
        let separator = if insertion_point == 0 || self.content[..insertion_point].ends_with('\n') {
            ""
        } else {
            "\n"
        };
        let insertion = format!("{separator} {name}: {value}\n");
        self.content.insert_str(insertion_point, &insertion);
    }

    pub fn get_array_property_count(&self, property_name: &str) -> usize {
        self.get_property(property_name)
            .and_then(|val| val.parse().ok())
            .filter(|count| *count <= MAX_ARRAY_ITEMS)
            .unwrap_or(0)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn make_doc(content: &str) -> SiiDocument {
        SiiDocument::new(content.to_string())
    }

    #[test]
    fn test_get_property_simple() {
        let doc = make_doc("money_account: 100500");
        assert_eq!(doc.get_property("money_account").unwrap(), "100500");
    }

    #[test]
    fn test_get_property_with_indent() {
        let doc = make_doc("   money_account: 100500");
        assert_eq!(doc.get_property("money_account").unwrap(), "100500");
    }

    #[test]
    fn test_get_property_not_found() {
        let doc = make_doc("money_account: 100500");
        assert!(doc.get_property("nonexistent").is_none());
    }

    #[test]
    fn test_get_property_with_quotes() {
        let doc = make_doc(" name: \"John\"");
        assert_eq!(doc.get_property("name").unwrap(), "\"John\"");
    }

    #[test]
    fn test_set_property_changes_value() {
        let mut doc = make_doc("money_account: 100");
        let changed = doc.set_property("money_account", "999").unwrap();
        assert!(changed);
        assert_eq!(doc.get_property("money_account").unwrap(), "999");
    }

    #[test]
    fn test_set_property_same_value() {
        let mut doc = make_doc("money_account: 100");
        let changed = doc.set_property("money_account", "100").unwrap();
        assert!(!changed);
    }

    #[test]
    fn test_set_property_preserves_indent() {
        let mut doc = make_doc("  money_account: 100");
        doc.set_property("money_account", "200").unwrap();
        // no trailing newline because input had none
        assert_eq!(doc.content(), "  money_account: 200");
    }

    #[test]
    fn test_get_array_property_empty() {
        let doc = make_doc("money_account: 100");
        let result = doc.get_array_property("cities").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_get_array_property_with_items() {
        let doc = make_doc("cities: 2\n cities[0]: \"city1\"\n cities[1]: \"city2\"");
        let result = doc.get_array_property("cities").unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], "\"city1\"");
        assert_eq!(result[1], "\"city2\"");
    }

    #[test]
    fn test_set_array_property() {
        let mut doc = make_doc("cities: 0");
        let items: Vec<String> = vec!["\"a\"".into(), "\"b\"".into()];
        let changed = doc.set_array_property("cities", &items).unwrap();
        assert!(changed);
        assert_eq!(doc.get_array_property_count("cities"), 2);
        assert_eq!(doc.get_array_property("cities").unwrap()[0], "\"a\"");
    }

    #[test]
    fn test_get_array_property_rejects_unreasonable_count() {
        let doc = make_doc("cities: 18446744073709551615");

        assert!(doc.get_array_property("cities").is_err());
    }

    #[test]
    fn test_set_array_property_rejects_unreasonable_count() {
        let mut doc = make_doc("cities: 0");
        let values = vec![String::new(); MAX_ARRAY_ITEMS + 1];

        assert!(doc.set_array_property("cities", &values).is_err());
        assert_eq!(doc.get_array_property_count("cities"), 0);
    }

    #[test]
    fn test_set_array_property_inserts_missing_count_and_all_values() {
        let mut doc = make_doc("SiiNunit\n{\n}\n");
        let values = vec!["\"berlin\"".into(), "\"paris\"".into()];

        assert!(doc.set_array_property("cities", &values).unwrap());

        assert_eq!(doc.get_array_property_count("cities"), 2);
        assert_eq!(
            doc.get_array_property("cities").unwrap(),
            vec!["\"berlin\"", "\"paris\""]
        );
    }

    #[test]
    fn test_get_array_property_count() {
        let doc = make_doc("trucks: 5");
        assert_eq!(doc.get_array_property_count("trucks"), 5);
    }

    #[test]
    fn test_get_array_property_count_missing() {
        let doc = make_doc("money_account: 100");
        assert_eq!(doc.get_array_property_count("trucks"), 0);
    }

    #[test]
    fn test_content_roundtrip() {
        let original = "money_account: 100\n experience_points: 500\n";
        let doc = make_doc(original);
        assert_eq!(doc.content(), original);
    }
}
