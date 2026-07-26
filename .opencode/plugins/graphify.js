// .opencode/plugins/graphify.js
// Lightweight project plugin: registers a `graphify` command alias that
// delegates to the global graphify SKILL (loaded from ~/.config/opencode/skills/graphify).
// The real extraction logic is owned by the skill, not this plugin.
// Keeping the plugin local lets us hook project-specific events (e.g. auto-run
// `graphify --update` after the agent edits many files) without forking the skill.

export const GraphifyPlugin = async ({ project, client, $, directory, worktree }) => {
  // Whisper a one-time bootstrap hint so the agent knows graphify is available
  // for this project. Do not block startup.
  try {
    await client.app.log({
      body: {
        service: "graphify-plugin",
        level: "info",
        message: `graphify plugin loaded for project "${project?.path ?? directory}"`,
      },
    })
  } catch {}

  return {
    // Example hook: whenever the agent finishes executing a bash command that
    // touches many files, remind it that it can refresh the knowledge graph.
    "tool.execute.after": async (input, output) => {
      if (input?.tool !== "bash") return
      const cmd = String(output?.args?.command ?? "")
      if (/(\bgit\s+checkout\b|\bgit\s+pull\b|\bnpm\s+install\b|\bpnpm\s+install\b)/.test(cmd)) {
        // Best-effort nudge; failures are ignored.
        try {
          await client.app.log({
            body: {
              service: "graphify-plugin",
              level: "debug",
              message: "Detected a dependency/branch change — consider running `graphify . --update` next.",
            },
          })
        } catch {}
      }
    },
  }
}
