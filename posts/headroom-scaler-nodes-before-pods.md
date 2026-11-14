---
title: "Adding Nodes Before Pods Exist: headroom-scaler"
date: "2026-11-12"
tags: ["Kubernetes", "AWS", "Python"]
excerpt: "A Kubernetes node autoscaler that keeps bin-packed headroom per PriorityClass, provisions declared demand ahead of time, and never evicts or binds a pod."
---

# Adding Nodes Before Pods Exist: headroom-scaler

A user runs an interactive query, its pod goes Pending because no node has room, an autoscaler asks the cloud for a node, and minutes later the query starts. Reactive node autoscaling is correct but always late, because it starts after a pod is already waiting. headroom-scaler is the controller I wrote to move that wait out of the user's path. Its goal is simple to state: a pod should find a node that already has room for it.

## Three sources of demand

The controller adds nodes for three reasons:

- **Headroom.** For each PriorityClass, keep enough free room for a number of pods of a given shape. Not "N free CPUs across the pool", but N slots where each slot fits entirely on one node.
- **Declared demand.** Workload systems create `CapacityDemand` objects: "8 pods of 4 CPU and 16Gi from 02:00", or "40 slots every weekday at 08:45 for three hours". Nodes are provisioned ahead of the window.
- **Unschedulable pods**, as a last resort, for anything nobody predicted.

Headroom grows with load. Each rule computes three terms and takes the largest:

```
required = max(floor,
               ceil(running_pods_of_class * percentOfUsed / 100),
               ceil(arrival_rate * lead_time))
```

The lead time is measured, not configured: it is the p90 of "node became Ready minus instance launch time" over the pool's current nodes, read from timestamps the cluster already has. The arrival rate comes from pod creation timestamps. Neither needs local history, which matters later.

## A pure planner

All decisions come from one function: `plan(snapshot) -> Plan`. The snapshot holds the policy, nodes, pods, demands, PriorityClass values, cloud group state and the current time. The planner does no I/O and reads no clock, so the same snapshot always gives the same plan. Every scenario becomes a test fixture, and the design doc records a planner benchmark of about 15 ms for a 5,000-pod, 100-node snapshot.

Inside, it is first-fit-decreasing bin packing. The items are pending pods first, then headroom slots and outstanding demand, sorted by priority, with demand before headroom and larger items first. The bins are, in order:

1. Ready, schedulable nodes with their actual free room, most loaded first;
2. incoming nodes, meaning nodes still warming up and instances the cloud has launched but that have not joined yet;
3. hypothetical new nodes of the pool's shape, opened only as needed.

The number of new bins opened is exactly the number of nodes to add, capped per step and by the pool maximum. Packing on cpu, memory and the node's pod count together is what makes "a slot fits on one node" true. Slots of a higher-priority class are packed first, so when the pool hits its maximum, the important headroom is the part that survives.

<figure class="js-figure" data-figure="headroom-demand"></figure>

Two details keep it from overshooting. In-flight instances count as full capacity until a provisioning timeout, so a burst seen in two consecutive passes adds nodes once. And pending pods may only be placed on nodes that became usable in the last 60 seconds; on older nodes the scheduler has already said no, while a just-ready node is about to receive them.

## What it refuses to do

The controller never binds a pod, never evicts one and never runs placeholder pods. It changes the desired size of a cloud node group, protects busy instances from the group's own scale-in, removes a startup taint once a new node has pulled the images the workload needs, and removes nodes that have been empty for a configured idle time.

That restraint has a consequence I spell out in the docs: headroom is accounting, not a reservation. Without placeholder pods, any pod the scheduler allows can use that free room, and the controller refills it on the next pass. If a batch workload must not eat interactive headroom, either give it its own pool with taints, or declare it as `CapacityDemand` so it is provisioned on top.

Scale-down is equally conservative. A node is a candidate only after being empty for the idle period, and it is removed only if everything else still fits on the remaining Ready nodes. Before the cloud call, the node is cordoned, its pods are re-listed, and if anything landed on it meanwhile the node is uncordoned and the removal is abandoned.

## Leader election and no local state

Two replicas run with Lease-based leader election. Only the leader watches and reconciles, in a single serial loop: events are debounced by a second, with a 15-second resync so time-based rules fire without events. A replica that cannot renew its lease exits so it restarts clean.

More useful: there is no local state to lose. Group size comes from the cloud, "empty since" and "being removed" are Node annotations, and conditions live in the policy status. A restarted leader recomputes the same plan, and a node left cordoned by a crashed leader is re-checked.

## Rolling it out

The first install is always dry-run. In dry-run the cloud provider is never handed to the actuator at all, so writes are impossible by construction rather than by a flag checked at each call site. The controller still reads everything, holds the lease, and writes its would-be actions to the policy status, logs and events. You run it next to the existing scaler for a day, compare decisions, then switch it on.

## Lessons

- **Make the decision a pure function.**
- **Pack, do not sum.** Free CPU spread over five nodes does not run one large pod.
- **Count in-flight capacity**, or every burst is paid for twice.
- **Let workloads declare what is coming.**
- **Keep state in the cluster**, so a restart is a non-event.
