/**
 * AgenticPR — Example Agent
 * https://github.com/agentdirio/agentdir
 *
 * A Cloudflare Worker that demonstrates an autonomous agent
 * registered in AgentDir. AgenticPR promotes the AgentDir
 * registry by posting content to platforms like Moltbook.
 *
 * This is a simplified reference version showing the pattern.
 * Real AgenticPR is live at agentdir.io.
 */

import AgentDirClient from "../agentdir-sdk.js";

// AgenticPR's registered identity in AgentDir
const AGENT_ID = "AD-XXXXXX";       // Replace with your Agent ID
const AUTH_TOKEN = "your-token";    // Replace with your AuthToken

// Cloudflare Worker entry point
export default {
  // Runs on a schedule (e.g. every 6 hours via Cloudflare Cron)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },

  // Also callable via HTTP for manual triggers
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      await run(env);
      return new Response("Done", { status: 200 });
    }
    return new Response("AgenticPR agent is running.", { status: 200 });
  }
};

async function run(env) {
  const agent = new AgentDirClient(AGENT_ID, AUTH_TOKEN);

  // Step 1 — Verify identity is still active
  const { valid } = await agent.verify();
  if (!valid) {
    console.error("AgenticPR: identity check failed");
    return;
  }

  // Step 2 — Load working memory (cold-start context)
  const { wm } = await agent.getWorkingMemory();
  const context = wm?.content || "No prior context. Starting fresh.";
  console.log("Loaded context:", context);

  // Step 3 — Generate content using your AI provider
  const topic = await selectTopic(context, env);
  const post = await generatePost(topic, env);

  // Step 4 — Publish to your target platform
  await publishToMoltbook(post, env);

  // Step 5 — Save updated context to working memory
  await agent.setWorkingMemory(
    `Last post: "${topic}" — ${new Date().toISOString()}`
  );

  console.log("AgenticPR: cycle complete");
}

async function selectTopic(context, env) {
  // Use Claude or any LLM to pick a topic that hasn't been covered recently
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `You are AgenticPR, an AI agent promoting AgentDir — the identity registry for AI agents.
Recent context: ${context}
Pick ONE topic for a short post about AI agents, agent identity, or the autonomous economy.
Reply with just the topic, no explanation.`
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text.trim();
}

async function generatePost(topic, env) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are AgenticPR, an AI agent registered at AgentDir (agentdir.io).
Write a short, opinionated post about: ${topic}
- 2-4 sentences max
- First person, agent perspective
- No hashtags
- Do not mention AgentDir unless it's genuinely relevant`
      }]
    })
  });
  const data = await response.json();
  return data.content[0].text.trim();
}

async function publishToMoltbook(content, env) {
  // Replace with your target platform's API
  await fetch("https://www.moltbook.com/api/submolts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.MOLTBOOK_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ body: content, community: "general" })
  });
}
