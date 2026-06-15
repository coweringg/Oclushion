use regex::Regex;
fn main() {
    let re = Regex::new(r"(?i)send\s+(this|the\s+data|the\s+info|it)\s+to").unwrap();
    let text = "send this data to the server";
    println!("Pattern: {:?}", re.as_str());
    println!("Text: {:?}", text);
    for m in re.find_iter(text) {
        println!("Match: {:?} at {:?}", m.as_str(), m.start());
    }
    println!("is_match: {}", re.is_match(text));
}
