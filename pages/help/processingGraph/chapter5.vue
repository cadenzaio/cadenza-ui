<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div class="chapter-content">
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink to="/help/processingGraph/chapter4">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink v-if="false" to="/help/processingGraph/chapter6">Next</NuxtLink>
          </span>
        </div>
        <h1>Chapter 5 – Real-World Flow</h1>
        <p><strong>Goal</strong>: Combine everything you’ve learned into a practical, distributed, fault-tolerant flow. In this example, we'll process a document through multiple stages including async validation, remote analysis, per-page review, and robust finalization.</p>
        <hr />
        <h2>Overview</h2>
        <p>We'll build:</p>
        <ol>
          <li>A local main service with document preparation and review logic</li>
          <li>A remote analysis service that performs OCR and metadata extraction</li>
          <li>Forked page-level review</li>
          <li>A graceful error handler</li>
        </ol>
        <hr />
        <h2>Step 1: Remote Analysis Service</h2>
        <pre><code class="language-ts">import ProcessingGraph from 'processing-graph';

const ocr = ProcessingGraph.createTask((ctx) => {
  ctx.steps = [...(ctx.steps || []), 'OCR'];
  return ctx;
}, 'OCR', 'Performs OCR on document', 2);

const meta = ProcessingGraph.createTask((ctx) => {
  ctx.steps = [...(ctx.steps || []), 'Metadata'];
  return ctx;
}, 'Metadata', 'Extracts metadata', 2);

const join = ProcessingGraph.createUniqueTask((contexts) => {
  return {
    steps: contexts.flatMap(c => c.steps || [])
  };
}, 'JoinRemote', 'Joins OCR + Metadata', 1);

join.doAfter(ocr);
join.doAfter(meta);

ProcessingGraph.createRoutine([ocr, meta], 'AnalyzeDoc', 'Remote analysis');

const server = ProcessingGraph.createServer('WorkerService', 'Handles OCR and metadata');
server.setPort(3000);
server.start();
</code></pre>
        <hr />
        <h2>Step 2: Main Service</h2>
        <pre><code class="language-ts">import ProcessingGraph from 'processing-graph';

// Async validation
const validate = ProcessingGraph.createTask(async (ctx) => {
  if (!ctx.document) throw new Error('Missing document');
  return ctx;
}, 'Validate', 'Checks input', 1);

// Deputy to remote analysis
const deputy = ProcessingGraph.createDeputyTask('AnalyzeDoc', 'WorkerService', 1);

// Fork page reviews
const forkPages = ProcessingGraph.createTask((ctx) => {
  const pages = ctx.pages || [];
  return function* () {
    for (const page of pages) {
      yield { ...ctx, page };
    }
  };
}, 'ForkPages', 'Splits into pages', 1);

const review = ProcessingGraph.createTask((ctx) => {
  ctx.reviewed = true;
  return ctx;
}, 'ReviewPage', 'Reviews a single page', 5);

// Join pages
const joinPages = ProcessingGraph.createUniqueTask((contexts) => ({
  reviewedPages: contexts.map(c => c.page)
}), 'JoinPages', 'Joins page results', 1);

// Finalize
const finalize = ProcessingGraph.createTask((ctx) => {
  console.log('Finalized doc:', ctx);
  return ctx;
}, 'Finalize', 'Wraps it up', 1);

// Error handler
const fallback = ProcessingGraph.createTask((ctx) => {
  console.error('Error:', ctx.error);
  return ctx;
}, 'ErrorHandler', 'Logs error', 1);

// Graph wiring
deputy.doAfter(validate);
forkPages.doAfter(deputy);
review.doAfter(forkPages);
joinPages.doAfter(review);
finalize.doAfter(joinPages);

validate.doOnFail(fallback);
deputy.doOnFail(fallback);

ProcessingGraph.createRoutine([validate], 'DocReview', 'Full document processing');

const server = ProcessingGraph.createServer('MainService', 'Handles full flow');
server.start();
</code></pre>
        <hr />
        <h2>Step 3: Trigger with Agent</h2>
        <pre><code class="language-ts">import ProcessingGraph from 'processing-graph';

const agent = ProcessingGraph.createAgent();
const result = await agent.createContract('DocReview', {
  document: 'doc-123',
  pages: [1, 2, 3]
});
console.log('Review result:', result);
</code></pre>
        <hr />
        <h2>Recap</h2>
        <p>This flow includes:</p>
        <ul>
          <li>Async task execution</li>
          <li>Conditional validation</li>
          <li>DeputyTasks to remote services</li>
          <li>Page-level fan-out using <code>yield</code></li>
          <li>Merging of branches via <code>createUniqueTask</code></li>
          <li>Error fallback using <code>.doOnFail</code></li>
        </ul>
        <hr />
        <h2>What’s Next?</h2>
        <p>In Chapter 6, we’ll explore how to use the UI dashboard to monitor this execution, inspect results, and retry or debug failed flows.</p>
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink to="/help/processingGraph/chapter4">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink v-if="false" to="/help/processingGraph/chapter6">Next</NuxtLink>
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
