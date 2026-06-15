use criterion::{criterion_group, criterion_main, Criterion};

use agent_evals::collector::task_metrics::TaskMetrics;
use agent_evals::engine::scorer::Scorer;
use agent_evals::storage::schema::MetricsSnapshot;
use agent_evals::AgentRole;

fn bench_single_scoring(c: &mut Criterion) {
    let metrics = TaskMetrics {
        first_pass_compilation: true,
        bug_detection_precision: 0.85,
        false_positive_rate: 0.1,
        plan_success_rate: 0.9,
        time_to_completion_s: 150.0,
        token_efficiency: 0.75,
        cost_per_task: 0.05,
        user_acceptance_rate: 0.88,
        visual_qa_pass_rate: 0.92,
        savings_accuracy: 0.8,
    };
    let snapshot = MetricsSnapshot::new(
        "bench-task".to_string(),
        AgentRole::Builder,
        metrics,
        1000.0,
    );

    c.bench_function("composite_score_builder", |b| {
        b.iter(|| Scorer::composite_score(&snapshot))
    });
}

fn bench_batch_scoring(c: &mut Criterion) {
    let mut snapshots = Vec::new();
    for i in 0..100 {
        let metrics = TaskMetrics {
            first_pass_compilation: i % 2 == 0,
            bug_detection_precision: 0.7 + (i as f64 * 0.002),
            false_positive_rate: 0.1,
            plan_success_rate: 0.8,
            time_to_completion_s: 100.0 + i as f64,
            token_efficiency: 0.6,
            cost_per_task: 0.05,
            user_acceptance_rate: 0.75,
            visual_qa_pass_rate: 0.8,
            savings_accuracy: 0.7,
        };
        let role = if i % 2 == 0 {
            AgentRole::Builder
        } else {
            AgentRole::Reviewer
        };
        snapshots.push(MetricsSnapshot::new(
            format!("task-{}", i),
            role,
            metrics,
            500.0,
        ));
    }

    c.bench_function("composite_score_batch_100", |b| {
        b.iter(|| {
            let scores: Vec<_> = snapshots.iter().map(|s| Scorer::composite_score(s)).collect();
            Scorer::average_composite_score(&scores)
        })
    });
}

criterion_group!(benches, bench_single_scoring, bench_batch_scoring);
criterion_main!(benches);
