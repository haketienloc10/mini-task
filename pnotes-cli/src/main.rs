use chrono::Local;
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

const NOTES_DIR: &str = ".project-notes/notes";

// ── CLI ──────────────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(name = "pnotes", about = "Project-level execution notes manager")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize .project-notes/notes/ directory
    Init,

    /// Add a new note
    Add {
        #[command(subcommand)]
        note_type: NoteType,
    },

    /// Recall relevant notes
    Recall {
        #[arg(long)]
        area: Vec<String>,
        #[arg(long)]
        tag: Vec<String>,
        #[arg(long)]
        task: Option<String>,
        #[arg(long, default_value = "3")]
        limit: usize,
    },

    /// Show full content of a note by ID
    Show { id: String },

    /// Print workflow guide and command reference
    Guide,
}

#[derive(Subcommand)]
enum NoteType {
    /// Add a continuity note
    Continuity {
        #[arg(long)]
        task: Option<String>,
        #[arg(long)]
        signal: Option<String>,
        #[arg(long)]
        area: Vec<String>,
        #[arg(long)]
        tag: Vec<String>,
        #[arg(long)]
        handoff: Option<String>,
        #[arg(long)]
        run: Option<String>,
    },
}

// ── Note schema ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct NoteFrontmatter {
    id: String,
    #[serde(rename = "type")]
    note_type: String,
    task: String,
    created_at: String,
    signal: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    run: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    handoff: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    areas: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    read_when: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    supersedes: Vec<String>,
}

// ── Frontmatter parser ───────────────────────────────────────────────────────

/// Extract YAML block between first pair of `---` delimiters.
fn extract_frontmatter(content: &str) -> Option<&str> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return None;
    }
    let after_first = &content[3..];
    // skip optional newline right after opening ---
    let after_first = after_first.trim_start_matches('\n').trim_start_matches('\r');
    let end = after_first.find("\n---")?;
    Some(&after_first[..end])
}

fn parse_frontmatter(content: &str) -> Result<NoteFrontmatter, String> {
    let yaml = extract_frontmatter(content).ok_or("No frontmatter found")?;
    serde_yaml::from_str(yaml).map_err(|e| format!("YAML parse error: {e}"))
}

// ── Path normalization ───────────────────────────────────────────────────────

fn normalize_path(p: &str) -> String {
    p.trim_end_matches('/').to_lowercase()
}

fn area_exact(note_area: &str, query: &str) -> bool {
    normalize_path(note_area) == normalize_path(query)
}

fn area_prefix(note_area: &str, query: &str) -> bool {
    let a = normalize_path(note_area);
    let b = normalize_path(query);
    a.starts_with(&b) || b.starts_with(&a)
}

// ── Scoring ──────────────────────────────────────────────────────────────────

struct RecallFilter {
    areas: Vec<String>,
    tags: Vec<String>,
    task: Option<String>,
}

fn score_note(fm: &NoteFrontmatter, filter: &RecallFilter) -> i32 {
    // Return -1 if no filters at all (handled outside)
    let has_filter = !filter.areas.is_empty() || !filter.tags.is_empty() || filter.task.is_some();
    if !has_filter {
        return 0; // will be handled as recency-only
    }

    let mut score = 0i32;

    // Area scoring: +5 exact, +4 prefix (per query area, take max match per note area)
    for q_area in &filter.areas {
        let mut area_score = 0i32;
        for n_area in &fm.areas {
            if area_exact(n_area, q_area) {
                area_score = area_score.max(5);
            } else if area_prefix(n_area, q_area) {
                area_score = area_score.max(4);
            }
        }
        score += area_score;
    }

    // Task match: +3
    if let Some(ref t) = filter.task {
        if fm.task == *t {
            score += 3;
        }
    }

    // Tag match: +2 each
    for q_tag in &filter.tags {
        if fm.tags.iter().any(|nt| nt == q_tag) {
            score += 2;
        }
    }

    // Text match in signal or read_when: +2
    let all_queries: Vec<&str> = filter
        .areas
        .iter()
        .map(|s| s.as_str())
        .chain(filter.tags.iter().map(|s| s.as_str()))
        .chain(filter.task.as_deref())
        .collect();

    for q in &all_queries {
        let q_lower = q.to_lowercase();
        let signal_lower = fm.signal.to_lowercase();
        let rw_text: String = fm
            .read_when
            .iter()
            .map(|s| s.to_lowercase())
            .collect::<Vec<_>>()
            .join(" ");
        if signal_lower.contains(&q_lower) || rw_text.contains(&q_lower) {
            score += 2;
            break; // +2 once per note
        }
    }

    score
}

// ── File helpers ─────────────────────────────────────────────────────────────

fn notes_dir() -> PathBuf {
    PathBuf::from(NOTES_DIR)
}

fn resolve_note_path(task_slug: &str, date: &str) -> PathBuf {
    let base = notes_dir();
    let mut path = base.join(format!("{date}-{task_slug}.md"));
    if !path.exists() {
        return path;
    }
    let mut suffix = 2;
    loop {
        path = base.join(format!("{date}-{task_slug}-{suffix}.md"));
        if !path.exists() {
            return path;
        }
        suffix += 1;
    }
}

// ── Commands ─────────────────────────────────────────────────────────────────

fn cmd_init() {
    let dir = notes_dir();
    if dir.exists() {
        println!("Already initialized");
    } else {
        fs::create_dir_all(&dir).expect("Failed to create .project-notes/notes/");
        println!("Initialized .project-notes/");
    }
}

fn cmd_add_continuity(
    task: Option<String>,
    signal: Option<String>,
    areas: Vec<String>,
    tags: Vec<String>,
    handoff: Option<String>,
    run: Option<String>,
) {
    // Validate required fields
    match (&task, &signal) {
        (None, _) | (_, None) => {
            eprintln!("Error: --task and --signal are required");
            std::process::exit(1);
        }
        _ => {}
    }
    let task = task.unwrap();
    let signal = signal.unwrap();

    let dir = notes_dir();
    if !dir.exists() {
        eprintln!("Run 'pnotes init' first");
        std::process::exit(1);
    }

    let date = Local::now().format("%Y-%m-%d").to_string();
    let id = format!("{date}-{task}");
    let file_path = resolve_note_path(&task, &date);

    let fm = NoteFrontmatter {
        id: id.clone(),
        note_type: "continuity".to_string(),
        task: task.clone(),
        created_at: date.clone(),
        signal: signal.clone(),
        run,
        handoff,
        areas,
        tags,
        read_when: vec![],
        supersedes: vec![],
    };

    let yaml = serde_yaml::to_string(&fm).expect("Failed to serialize frontmatter");
    // serde_yaml adds trailing newline already
    let body = format!(
        "---\n{yaml}---\n\n## task\n{task} — {date}\n\n## deviations\nNone\n\n## traps\nNone\n\n## dead_ends\nNone\n\n## validation_delta\nAs expected\n\n## next_agent_hint\nSee Handoff\n"
    );

    fs::write(&file_path, body).expect("Failed to write note file");
    println!("Created: {}", file_path.display());
}

fn load_all_notes() -> Vec<(PathBuf, NoteFrontmatter)> {
    let dir = notes_dir();
    if !dir.exists() {
        return vec![];
    }

    let mut notes = vec![];
    for entry in WalkDir::new(&dir)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path().to_path_buf();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Warning: could not read {}: {e}", path.display());
                continue;
            }
        };
        match parse_frontmatter(&content) {
            Ok(fm) => notes.push((path, fm)),
            Err(e) => {
                eprintln!("Warning: skipping {} — {e}", path.display());
            }
        }
    }
    notes
}

fn cmd_recall(areas: Vec<String>, tags: Vec<String>, task: Option<String>, limit: usize) {
    let notes = load_all_notes();
    if notes.is_empty() {
        println!("No notes found");
        return;
    }

    let filter = RecallFilter {
        areas: areas.clone(),
        tags: tags.clone(),
        task: task.clone(),
    };
    let has_filter = !areas.is_empty() || !tags.is_empty() || task.is_some();

    // (score, created_at, path, fm)
    let mut scored: Vec<(i32, String, PathBuf, NoteFrontmatter)> = notes
        .into_iter()
        .map(|(path, fm)| {
            let s = if has_filter {
                score_note(&fm, &filter)
            } else {
                0 // recency only
            };
            let date = fm.created_at.clone();
            (s, date, path, fm)
        })
        .filter(|(score, _, _, _)| !has_filter || *score > 0)
        .collect();

    if scored.is_empty() {
        println!("No notes found");
        return;
    }

    // Sort: score DESC, then created_at DESC
    scored.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));

    // Recency boost: newest gets +1 (applied after initial sort to break ties)
    // Re-sort with recency boost included
    let max_date = scored.iter().map(|(_, d, _, _)| d.clone()).max().unwrap_or_default();
    let mut scored: Vec<(i32, String, PathBuf, NoteFrontmatter)> = scored
        .into_iter()
        .map(|(s, d, p, fm)| {
            let boost = if d == max_date { 1 } else { 0 };
            (s + boost, d, p, fm)
        })
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));

    for (_, _, _, fm) in scored.into_iter().take(limit) {
        let areas_str = if fm.areas.is_empty() {
            "(none)".to_string()
        } else {
            fm.areas.join(", ")
        };
        let tags_str = if fm.tags.is_empty() {
            "(none)".to_string()
        } else {
            fm.tags.join(", ")
        };
        println!("--- {} ---", fm.id);
        println!("signal: {}", fm.signal);
        println!("areas:  {}", areas_str);
        println!("tags:   {}", tags_str);
        println!("task:   {}", fm.task);
        println!("date:   {}", fm.created_at);
        println!();
    }
}

fn cmd_show(id: &str) {
    let path = notes_dir().join(format!("{id}.md"));
    if !path.exists() {
        eprintln!("Note not found: {id}");
        std::process::exit(1);
    }
    let content = fs::read_to_string(&path).expect("Failed to read note");
    print!("{content}");
}

fn cmd_guide() {
    println!(
        r#"pnotes — project-level execution notes
======================================

WORKFLOW
--------
1. At session start:  pnotes recall [--area <path>] [--task <slug>]
2. Before finishing:  pnotes add continuity --task <slug> --signal "<summary>" [--area <path>]...
3. Next session:      pnotes recall --task <slug>   (pick up where you left off)

COMMANDS
--------
pnotes init
    Create .project-notes/notes/ directory. Safe to run multiple times.

pnotes add continuity --task <slug> --signal "<text>" [options]
    Create a continuity note. Required: --task, --signal.
    Options:
      --area <path>     Area of code affected (repeatable)
      --tag <tag>       Tag for filtering (repeatable)
      --handoff <path>  Relative path to handoff document
      --run <id>        Run/session identifier

pnotes recall [options]
    Scan notes and return top matches. Default limit: 3.
    Options:
      --area <path>     Filter by area (exact +5, prefix +4)
      --tag <tag>       Filter by tag (+2 each)
      --task <slug>     Filter by task (+3)
      --limit <n>       Max results (default: 3)
    No filters: returns top N most recent notes.

pnotes show <id>
    Print full content of note with given ID.
    Example: pnotes show 2026-05-25-auth-fix

pnotes guide
    Print this help.

DECISION TREE
-------------
→ Starting work on a task?
    pnotes recall --task <slug>

→ Starting work in a specific area?
    pnotes recall --area <path>

→ Finishing a session?
    pnotes add continuity --task <slug> --signal "<what happened>"

→ Need to read a specific note?
    pnotes show <id>
"#
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    let cli = Cli::parse();
    match cli.command {
        Commands::Init => cmd_init(),
        Commands::Add {
            note_type: NoteType::Continuity { task, signal, area, tag, handoff, run },
        } => cmd_add_continuity(task, signal, area, tag, handoff, run),
        Commands::Recall { area, tag, task, limit } => cmd_recall(area, tag, task, limit),
        Commands::Show { id } => cmd_show(&id),
        Commands::Guide => cmd_guide(),
    }
}

// ── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_fm(task: &str, areas: Vec<&str>, tags: Vec<&str>, signal: &str) -> NoteFrontmatter {
        NoteFrontmatter {
            id: format!("2026-05-25-{task}"),
            note_type: "continuity".to_string(),
            task: task.to_string(),
            created_at: "2026-05-25".to_string(),
            signal: signal.to_string(),
            run: None,
            handoff: None,
            areas: areas.into_iter().map(String::from).collect(),
            tags: tags.into_iter().map(String::from).collect(),
            read_when: vec![],
            supersedes: vec![],
        }
    }

    fn filter(areas: Vec<&str>, tags: Vec<&str>, task: Option<&str>) -> RecallFilter {
        RecallFilter {
            areas: areas.into_iter().map(String::from).collect(),
            tags: tags.into_iter().map(String::from).collect(),
            task: task.map(String::from),
        }
    }

    #[test]
    fn test_path_normalization() {
        assert_eq!(normalize_path("src/auth/"), "src/auth");
        assert_eq!(normalize_path("SRC/Auth"), "src/auth");
        assert_eq!(normalize_path("src/auth"), "src/auth");
    }

    #[test]
    fn test_scoring_exact_area() {
        let fm = make_fm("fix", vec!["src/session-manager"], vec![], "test");
        let f = filter(vec!["src/session-manager"], vec![], None);
        assert_eq!(score_note(&fm, &f), 5);
    }

    #[test]
    fn test_scoring_prefix_area() {
        // note area: src/session-manager, query: src/
        let fm = make_fm("fix", vec!["src/session-manager"], vec![], "test");
        let f = filter(vec!["src/"], vec![], None);
        assert_eq!(score_note(&fm, &f), 4);

        // Reverse: note area src/, query src/session-manager
        let fm2 = make_fm("fix", vec!["src/"], vec![], "test");
        let f2 = filter(vec!["src/session-manager"], vec![], None);
        assert_eq!(score_note(&fm2, &f2), 4);
    }

    #[test]
    fn test_scoring_task_match() {
        let fm = make_fm("auth-fix", vec![], vec![], "test");
        let f = filter(vec![], vec![], Some("auth-fix"));
        assert_eq!(score_note(&fm, &f), 3);
    }

    #[test]
    fn test_scoring_no_match() {
        let fm = make_fm("unrelated", vec!["lib/util"], vec!["perf"], "minor fix");
        let f = filter(vec!["src/auth"], vec!["bug"], Some("auth-fix"));
        assert_eq!(score_note(&fm, &f), 0);
    }

    #[test]
    fn test_frontmatter_parse_valid() {
        let content = r#"---
id: "2026-05-25-test"
type: "continuity"
task: "test"
created_at: "2026-05-25"
signal: "hello world"
---

## task
test
"#;
        let fm = parse_frontmatter(content).unwrap();
        assert_eq!(fm.id, "2026-05-25-test");
        assert_eq!(fm.task, "test");
        assert_eq!(fm.signal, "hello world");
    }

    #[test]
    fn test_frontmatter_parse_missing_required() {
        // Missing signal field
        let content = r#"---
id: "2026-05-25-test"
type: "continuity"
task: "test"
created_at: "2026-05-25"
---
"#;
        let result = parse_frontmatter(content);
        assert!(result.is_err());
    }

    #[test]
    fn test_frontmatter_parse_malformed_yaml() {
        let content = r#"---
id: [bad yaml
---
"#;
        let result = parse_frontmatter(content);
        assert!(result.is_err());
    }
}
