use criterion::{black_box, criterion_group, criterion_main, Criterion};
use agent_canvas::graph::dag::Dag;
use agent_canvas::graph::node::{Node, NodeKind};
use agent_canvas::graph::edge::Edge;

fn build_large_dag(node_count: usize) -> Dag {
    let mut dag = Dag::new();

    let mut prev_id = uuid::Uuid::new_v4();
    dag.add_node(Node::new(prev_id, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![]));

    for i in 1..node_count {
        let cur_id = uuid::Uuid::new_v4();
        dag.add_node(Node::new(cur_id, NodeKind::Agent, serde_json::json!({}), (i as f64 * 100.0, 0.0), vec![]));
        dag.add_edge(Edge::new(uuid::Uuid::new_v4(), prev_id, uuid::Uuid::nil(), cur_id, uuid::Uuid::nil())).unwrap();
        prev_id = cur_id;
    }

    dag
}

fn bench_dag_creation(c: &mut Criterion) {
    c.bench_function("dag_creation_100", |b| {
        b.iter(|| {
            let dag = build_large_dag(black_box(100));
            black_box(dag);
        })
    });
}

fn bench_topological_sort(c: &mut Criterion) {
    let dag = build_large_dag(100);

    c.bench_function("topological_sort_100", |b| {
        b.iter(|| {
            let result = dag.topological_sort();
            black_box(result)
        })
    });
}

fn bench_cycle_detection(c: &mut Criterion) {
    let dag = build_large_dag(100);

    c.bench_function("cycle_detection_100", |b| {
        b.iter(|| {
            let has = dag.has_cycle();
            black_box(has)
        })
    });
}

fn bench_add_remove_nodes(c: &mut Criterion) {
    c.bench_function("add_remove_50_nodes", |b| {
        b.iter(|| {
            let mut dag = Dag::new();
            let mut ids = Vec::new();
            for _ in 0..50 {
                let id = uuid::Uuid::new_v4();
                dag.add_node(Node::new(id, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![]));
                ids.push(id);
            }
            for id in &ids {
                dag.remove_node(*id).ok();
            }
            black_box(dag);
        })
    });
}

fn bench_get_children_parents(c: &mut Criterion) {
    let dag = build_large_dag(100);
    let node_ids: Vec<_> = dag.nodes.keys().copied().collect();

    c.bench_function("get_children_parents_100", |b| {
        b.iter(|| {
            for id in &node_ids {
                let _ = dag.get_children(id);
                let _ = dag.get_parents(id);
            }
            black_box(())
        })
    });
}

criterion_group! {
    name = benches;
    config = Criterion::default().sample_size(10);
    targets = bench_dag_creation, bench_topological_sort, bench_cycle_detection, bench_add_remove_nodes, bench_get_children_parents
}
criterion_main!(benches);
