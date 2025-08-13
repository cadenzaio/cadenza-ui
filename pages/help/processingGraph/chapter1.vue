<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div class="chapter-content">
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink v-if="false" to="/help/processingGraph/chapter0">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink to="/help/processingGraph/chapter2">Next</NuxtLink>
          </span>
        </div>

<h1>Chapter 1 – Hello Graph!</h1>
<p><strong>Goal</strong>: Get your first processing graph running in under 5 minutes, understand tasks and context flow, and see the graph in action.</p>
<hr>
<h2>Step 1: Install the Framework</h2>
<p>Install via npm:</p>
<pre><code class="language-bash">npm install processing-graph
</code></pre>
<p>This gives you access to the API used to define, run, and distribute workflows.</p>
<hr>
<h2>Step 2: Create Your First Task</h2>
<p>A task is defined by a function that receives a context object and optionally returns an updated context.</p>
<pre><code class="language-ts">import ProcessingGraph from 'processing-graph';

const greet = ProcessingGraph.createTask((context) =&gt; {
  context.message = `Hello, ${context.name || 'world'}!`;
  return context;
}, 'Greet', 'Creates a greeting', 1);
</code></pre>
<hr>
<h2>Step 3: Run the Task Locally</h2>
<p>Use the built-in runner to execute the task locally with a sample context:</p>
<pre><code class="language-ts">const runner = ProcessingGraph.createRunner();

runner.run(greet, { name: 'Alice' });
</code></pre>
<p>The context is passed to the task and updated along the way.</p>
<hr>
<h2>Step 4: Create a Simple Flow</h2>
<p>Now let’s add a second task and create a minimal graph:</p>
<pre><code class="language-ts">const print = ProcessingGraph.createTask((context) =&gt; {
  console.log(context.message);
  return true;
}, 'Print', 'Logs the message', 1);

// Define execution order:
print.doAfter(greet);

// Create a routine:
ProcessingGraph.createRoutine([greet], 'SimpleGreeting', 'Says hello and prints it');
</code></pre>
<hr>
<h2>Step 5: Visualize It</h2>
<p>Once run, the framework will automatically record execution data to the local database. If you're using the UI dashboard:</p>
<ul>
<li>You’ll see the graph</li>
<li>Each task will be highlighted as it runs</li>
<li>You can inspect the context after each step</li>
</ul>
<hr>
<h2>Recap</h2>
<p>You’ve just:</p>
<ul>
<li>Defined tasks</li>
<li>Linked them with <code>.doAfter(...)</code></li>
<li>Executed a graph locally</li>
<li>Seen how the context moves through the flow</li>
</ul>
<hr>
<h2>What’s Next?</h2>
<p>In Chapter 2, we’ll add:</p>
<ul>
<li><strong>Branches</strong></li>
<li><strong>Async functions</strong></li>
<li><strong>Forked contexts</strong></li>
<li><strong>Join tasks</strong></li>
</ul>
<p>and build a much richer, parallel graph.</p>
<hr>
        <div class="chapter-nav">
          <span class="chapter-nav-left">
            <NuxtLink v-if="false" to="/help/processingGraph/chapter0">Previous</NuxtLink>
          </span>
          <span class="chapter-nav-right">
            <NuxtLink to="/help/processingGraph/chapter2">Next</NuxtLink>
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
