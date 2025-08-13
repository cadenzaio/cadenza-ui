<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        Help
      </template>
      <div class="help-section">
        <q-card class="help-block" flat bordered>
          <q-card-section>
            <h3>Technical Description</h3>
            <p>
              This dashboard is a web-based application built with Nuxt and Vue, designed to provide real-time monitoring, management, and analytics for your routines, tasks, servers, and agents. It integrates with backend APIs and databases to fetch, display, and interact with operational data in a user-friendly interface.
            </p>
          </q-card-section>
        </q-card>
        <q-card class="help-block" flat bordered>
          <q-card-section>
            <h3>Best Practices</h3>
            <ul>
              <li>Regularly review dashboard data to monitor system health and performance.</li>
              <li>Keep your user profile and settings up to date for personalized experience.</li>
              <li>Use the export and reporting features to back up important data.</li>
              <li>Log out after each session to maintain security.</li>
            </ul>
          </q-card-section>
        </q-card>
        <q-card class="help-block" flat bordered>
          <q-card-section>
            <h3>Deployment</h3>
            <p>
              The dashboard can be deployed on any modern web server. For production, build the app using <code>npm run build</code> and serve the output with a Node.js server or static hosting service. Ensure environment variables and API endpoints are configured correctly in <code>nuxt.config.ts</code>.
            </p>
          </q-card-section>
        </q-card>
        <q-card class="help-block" flat bordered>
          <q-card-section>
            <h3>Features</h3>
            <ul>
              <li>Interactive maps and charts for visualizing routines, tasks, and server status.</li>
              <li>User authentication and role-based access control.</li>
              <li>Real-time updates and notifications.</li>
              <li>Comprehensive help and FAQ sections.</li>
              <li>Data export and reporting tools.</li>
            </ul>
          </q-card-section>
        </q-card>
        <q-card class="help-block" flat bordered>
          <q-card-section>
            <h3>Settings</h3>
            <p>
              Access the settings page from the main menu to update your profile, change your password, configure notification preferences, and manage data export options. Settings are saved securely and applied immediately.
            </p>
          </q-card-section>
        </q-card>
        <q-card class="help-block" flat bordered>
          <q-card-section>
            <h3>Parameters</h3>
            <p>
              Key parameters include API endpoints, authentication tokens, user preferences, and dashboard display options. These can be configured in the settings or via environment variables for advanced users and administrators.
            </p>
          </q-card-section>
        </q-card>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup>
</script>

<style scoped>
.help-section {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1.5rem;
}
.help-block {
  margin-bottom: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  background: #f5f5f5;
}
.help-block h3 {
  margin-top: 0;
  color: #2d3a4a;
  font-size: 1.3rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.help-block p, .help-block ul {
  color: #333;
  font-size: 1.05rem;
  margin-bottom: 0.5rem;
}
.help-block ul {
  padding-left: 1.2rem;
}
.help-block li {
  margin-bottom: 0.3rem;
  line-height: 1.6;
}
code {
  background: #e0e7ef;
  border-radius: 4px;
  padding: 0.1em 0.4em;
  font-size: 0.98em;
}
</style>
