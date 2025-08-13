<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div class="chapter-content">
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink to="/help/processingGraph/chapter1">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink to="/help/processingGraph/chapter3">Next</NuxtLink>
          </span>
        </div>
        <h1>Chapter 2 – Branch Out</h1>
        <p><strong>Goal</strong>: Learn how to build a true graph structure with parallel branches, joins, async tasks, and forked executions using yielded contexts.</p>
        <hr />
        <h2>1. Add More Tasks</h2>
        <p>We'll start by defining three simple tasks:</p>
        <pre><code class="language-ts">const fetchUser = ProcessingGraph.createTask(async (context) => {
  context.user = { id: 1, name: 'Alice' };
  return context;
}, 'FetchUser', 'Simulates fetching user data', 1);

const enrichUser = ProcessingGraph.createTask((context) => {
  context.user.enriched = true;
  return context;
}, 'EnrichUser', 'Adds enrichment to user object', 1);

const logUser = ProcessingGraph.createTask((context) => {
  console.log('User:', context.user);
  return true;
}, 'LogUser', 'Logs user info', 1);</code></pre>
        <hr />
        <h2>2. Branching and Parallelism</h2>
        <p>We can run <code>enrichUser</code> and <code>logUser</code> <strong>in parallel</strong> after <code>fetchUser</code>:</p>
        <pre><code class="language-ts">enrichUser.doAfter(fetchUser);
logUser.doAfter(fetchUser);</code></pre>
        <p>This creates two branches that run concurrently after the same parent.</p>
        <hr />
        <h2>3. Join Tasks with <code>createUniqueTask</code></h2>
        <p>We can re-merge branches using a <strong>unique task</strong>, which will wait for all parent branches:</p>
        <pre><code class="language-ts">const summarize = ProcessingGraph.createUniqueTask((contexts) => {
  return {
    summary: contexts.map(c => c.user),
  };
}, 'Summarize', 'Merges data from multiple branches', 1);

summarize.doAfter(enrichUser);
summarize.doAfter(logUser);</code></pre>
        <hr />
        <h2>4. Fork with <code>yield</code> to Create Parallel Subflows</h2>
        <p>Let’s say we want to create a review task <strong>for each item</strong> in a list:</p>
        <pre><code class="language-ts">const forkReviews = ProcessingGraph.createTask((context) => {
  return function* () {
    for (const item of context.items || []) {
      yield { ...context, reviewItem: item };
    }
  };
}, 'ForkReviews', 'Forks graph into per-item review tasks', 1);</code></pre>
        <p>Then each branch gets processed by:</p>
        <pre><code class="language-ts">const review = ProcessingGraph.createTask((ctx) => {
  console.log('Reviewing:', ctx.reviewItem);
  return ctx;
}, 'Review', 'Processes one item', 3);

review.doAfter(forkReviews);</code></pre>
        <hr />
        <h2>5. Async Behavior</h2>
        <p>Tasks defined with <code>async</code> are automatically awaited before their children run. No special handling needed.</p>
        <hr />
        <h2>6. Routine Definition and Execution</h2>
        <p>Let’s register the full routine:</p>
        <pre><code class="language-ts">ProcessingGraph.createRoutine([fetchUser, forkReviews], 'BranchingDemo', 'Demonstrates branching and joining');</code></pre>
        <p>And run it:</p>
        <pre><code class="language-ts">const runner = ProcessingGraph.createRunner();
runner.run(fetchUser, {
  items: ['apple', 'banana', 'cherry']
});</code></pre>
        <hr />
        <h2>Recap</h2>
        <p>In this chapter, you learned how to:</p>
        <ul>
          <li>Execute tasks in <strong>parallel</strong></li>
          <li>Merge results with <strong>join tasks</strong></li>
          <li>Create dynamic <strong>subflows using yield</strong></li>
          <li>Use <strong>async tasks</strong> without extra config</li>
        </ul>
        <hr />
        <h2>Up Next: Chapter 3 – Distributed Without Tears</h2>
        <p>We’ll connect multiple services and delegate work between them using <code>DeputyTask</code>.</p>
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink to="/help/processingGraph/chapter1">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink to="/help/processingGraph/chapter3">Next</NuxtLink>
          </span>
        </div>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
</script>

<style>
.chapter-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.chapter-content pre {
  background: #222;
  color: #fff;
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
}
.chapter-content code {
  font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
  font-size: 0.98em;
}
.chapter-nav {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  margin-top: 1.5rem;
}
.chapter-nav-left {
  flex: 1;
  display: flex;
  justify-content: flex-start;
}
.chapter-nav-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}
.chapter-nav a {
  color: #42b983;
  font-weight: bold;
  text-decoration: none;
  font-size: 1.1em;
}
.chapter-nav a:hover {
  color: #2c3e50;
}
</style>
