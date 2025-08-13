<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div class="chapter-content">
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink to="/help/processingGraph/chapter3">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink to="/help/processingGraph/chapter5">Next</NuxtLink>
          </span>
        </div>
        <h1>Chapter 4 – Break Stuff Gracefully</h1>
        <p><strong>Goal</strong>: Learn how the framework handles errors by default, how to define error flows using <code>.doOnFail()</code>, and how to prepare for more advanced fault tolerance patterns.</p>
        <hr />
        <h2>1. Default Error Behavior</h2>
        <p>If a task throws an error or fails unexpectedly and no error handler is defined, the following happens:</p>
        <ul>
          <li>The task execution stops</li>
          <li>The graph execution halts at that point</li>
          <li>The context is returned (with the error info attached)</li>
        </ul>
        <p>You do <strong>not</strong> need to write try/catch logic in your tasks.</p>
        <hr />
        <h2>2. Graceful Error Handling with <code>.doOnFail()</code></h2>
        <p>Let’s define a task that might fail:</p>
        <pre><code class="language-ts">const risky = ProcessingGraph.createTask((ctx) => {
  if (!ctx.ok) throw new Error("Something went wrong!");
  ctx.success = true;
  return ctx;
}, 'Risky', 'Might throw an error', 1);</code></pre>
        <p>Define an error handler:</p>
        <pre><code class="language-ts">const fallback = ProcessingGraph.createTask((ctx) => {
  console.warn('[RECOVERY]', ctx.error || 'Unknown error');
  ctx.recovered = true;
  return ctx;
}, 'Fallback', 'Logs the error and recovers', 1);</code></pre>
        <p>Attach it to the risky task:</p>
        <pre><code class="language-ts">risky.doOnFail(fallback);</code></pre>
        <hr />
        <h2>3. Marking Failures Manually</h2>
        <p>You don’t have to throw errors. You can also return a context with <code>.failed = true</code> or <code>.errored = true</code>.</p>
        <pre><code class="language-ts">const conditional = ProcessingGraph.createTask((ctx) => {
  if (!ctx.ready) {
    ctx.failed = true;
    return ctx;
  }
  return ctx;
}, 'ConditionCheck', 'Fails softly if not ready', 1);</code></pre>
        <p>The <code>.doOnFail()</code> path will trigger just like if the task had thrown.</p>
        <hr />
        <h2>4. Advanced Error Graphs (Optional)</h2>
        <p>You can also link an entire graph under a <code>.doOnFail()</code> node:</p>
        <pre><code class="language-ts">const alert = ProcessingGraph.createTask(...);
const cleanup = ProcessingGraph.createTask(...);

alert.doAfter(fallback);
cleanup.doAfter(alert);

risky.doOnFail(fallback);</code></pre>
        <p>This creates a full <strong>error subgraph</strong> triggered only if <code>risky</code> fails.</p>
        <hr />
        <h2>5. What Not To Do</h2>
        <p><code>.doOnFail()</code> should <strong>not</strong> be used for conditional branching or core flow logic. It is designed for:</p>
        <ul>
          <li>Logging</li>
          <li>Cleanup</li>
          <li>Alerting</li>
          <li>Optional retries (if done carefully)</li>
        </ul>
        <hr />
        <h2>6. Looking Ahead: Retries and Recovery</h2>
        <ul>
          <li>Task-level retries are coming soon (<code>retries</code>, <code>delay</code>, <code>backoff</code>)</li>
          <li>Automatic resume from last task after a crash is in development</li>
          <li>Manual restart via the dashboard is supported</li>
        </ul>
        <hr />
        <h2>Recap</h2>
        <p>You’ve learned:</p>
        <ul>
          <li>What happens when a task fails</li>
          <li>How to add error recovery with <code>.doOnFail()</code></li>
          <li>That you can manually fail a task via <code>ctx.failed</code></li>
          <li>How to attach fallback graphs</li>
          <li>That recovery and retries are core parts of the framework’s roadmap</li>
        </ul>
        <hr />
        <h2>Next: Chapter 5 – Real-World Flow</h2>
        <p>Let’s combine what you’ve learned into a practical, multi-branch, distributed graph — with remote routines, page-level forks, and error-aware joins.</p>
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink to="/help/processingGraph/chapter3">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink to="/help/processingGraph/chapter5">Next</NuxtLink>
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
