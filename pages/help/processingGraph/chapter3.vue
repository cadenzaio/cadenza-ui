<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div class="chapter-content">
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink to="/help/processingGraph/chapter2">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink to="/help/processingGraph/chapter4">Next</NuxtLink>
          </span>
        </div>
        <h1>Chapter 3 – Distributed Without Tears</h1>
        <p><strong>Goal</strong>: Run two independent services on separate ports, each with its own graph, and demonstrate how to delegate execution across services using <code>DeputyTask</code>. Trigger the flow using an <code>Agent</code>.</p>
        <hr />
        <h2>Overview</h2>
        <p>You’ll build:</p>
        <ul>
          <li><strong>Service A</strong>: Hosts a local graph and starts the flow</li>
          <li><strong>Service B</strong>: Hosts a subroutine and runs on a different port</li>
        </ul>
        <hr />
        <h2>Service B: Analysis Service (Port 3000)</h2>
        <pre><code class="language-ts">import ProcessingGraph from 'processing-graph';

const analyze = ProcessingGraph.createTask((ctx) => {
  ctx.analysis = `Analysis complete for: ${ctx.input}`;
  return ctx;
}, 'Analyze', 'Performs a remote analysis', 1);

ProcessingGraph.createRoutine([analyze], 'AnalyzeRoutine', 'Basic analysis flow');

const server = ProcessingGraph.createServer('AnalysisService', 'Runs analysis routines');
server.setPort(3000);
server.start();
</code></pre>
        <hr />
        <h2>Service A: Main Service (Default Port)</h2>
        <pre><code class="language-ts">import ProcessingGraph from 'processing-graph';

const prepare = ProcessingGraph.createTask((ctx) => {
  ctx.input = `Document #${ctx.id}`;
  return ctx;
}, 'Prepare', 'Prepares input', 1);

// Create deputy to remote routine
const deputy = ProcessingGraph.createDeputyTask('AnalyzeRoutine', 'AnalysisService', 1);

// Continue locally after the remote task returns
const report = ProcessingGraph.createTask((ctx) => {
  console.log('[REPORT]', ctx.analysis);
  return true;
}, 'Report', 'Logs remote analysis result', 1);

// Connect graph
deputy.doAfter(prepare);
report.doAfter(deputy);

// Create routine
ProcessingGraph.createRoutine([prepare], 'MainRoutine', 'Delegates to remote service');

const server = ProcessingGraph.createServer('MainService', 'Triggers distributed flows');
server.start();
</code></pre>
        <hr />
        <h2>Step 3: Trigger the Routine with an Agent</h2>
        <p>Create a separate script or module to act as a trigger:</p>
        <pre><code class="language-ts">import ProcessingGraph from 'processing-graph';

const agent = ProcessingGraph.createAgent();
const result = await agent.createContract('MainRoutine', { id: 42 });

console.log('Execution result:', result);
</code></pre>
        <hr />
        <h2>Running the Demo</h2>
        <ol>
          <li><strong>Terminal 1: Start Analysis Service</strong>
            <pre><code class="language-bash">node analysis-service.js</code></pre>
          </li>
          <li><strong>Terminal 2: Start Main Service</strong>
            <pre><code class="language-bash">node main-service.js</code></pre>
          </li>
          <li><strong>Terminal 3: Trigger via Agent</strong>
            <pre><code class="language-bash">node agent-trigger.js</code></pre>
          </li>
        </ol>
        <hr />
        <h2>How It Works</h2>
        <ul>
          <li>Service A runs <code>Prepare</code></li>
          <li>Sends context to Service B using <code>DeputyTask</code></li>
          <li>Service B runs <code>AnalyzeRoutine</code>, returns result</li>
          <li>Service A continues with <code>Report</code></li>
          <li><code>Agent</code> triggers and receives the final result</li>
        </ul>
        <hr />
        <h2>Recap</h2>
        <p>You now understand:</p>
        <ul>
          <li>How to run two services on separate ports</li>
          <li>How to delegate part of a workflow to a remote service</li>
          <li>How to trigger a routine execution with an <code>Agent</code></li>
          <li>That service discovery, routing, and context passing is all automatic</li>
        </ul>
        <hr />
        <h2>What’s Next?</h2>
        <p>In Chapter 4, we’ll explore error handling, failure reporting, and recovery flows.</p>
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink to="/help/processingGraph/chapter2">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink to="/help/processingGraph/chapter4">Next</NuxtLink>
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
