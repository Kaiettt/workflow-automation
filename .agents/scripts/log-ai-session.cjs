const fs = require('fs');
const path = require('path');

// Always reply with valid hook response to stdout so agent loop is never blocked
function finishHook() {
  process.stdout.write(JSON.stringify({ decision: 'stop' }) + '\n');
}

async function main() {
  let rawInput = '';
  for await (const chunk of process.stdin) {
    rawInput += chunk;
  }

  let hookContext = {};
  try {
    if (rawInput.trim()) {
      hookContext = JSON.parse(rawInput);
    }
  } catch (err) {
    // ignore parse error
  }

  const conversationId = hookContext.conversationId || 'default-session';
  const transcriptPath = hookContext.transcriptPath;
  const workspaceRoot = (hookContext.workspacePaths && hookContext.workspacePaths[0])
    ? hookContext.workspacePaths[0]
    : path.resolve(__dirname, '../..');

  const outputDir = path.join(workspaceRoot, 'logs', 'ai-sessions');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let transcriptLines = [];
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const fileData = fs.readFileSync(transcriptPath, 'utf8');
      transcriptLines = fileData.split('\n').filter(Boolean);
    } catch (e) {
      // ignore
    }
  }

  // Group steps by conversation turns
  const turns = [];
  let currentTurn = null;

  for (const line of transcriptLines) {
    try {
      const step = JSON.parse(line);

      if (step.type === 'USER_INPUT') {
        if (currentTurn) {
          turns.push(currentTurn);
        }

        let content = step.content || '';
        const match = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/.exec(content);
        if (match) {
          content = match[1].trim();
        }

        currentTurn = {
          prompt: content.trim(),
          timestamp: step.created_at || null,
          response: '',
        };
      } else if (step.type === 'PLANNER_RESPONSE' && currentTurn) {
        // Collect latest final response content (ignoring thoughts and tool calls)
        if (step.content && step.content.trim()) {
          currentTurn.response = step.content.trim();
        }
      }
    } catch (e) {
      // ignore line parse error
    }
  }

  if (currentTurn) {
    turns.push(currentTurn);
  }

  // Format clean Markdown log (Prompt & Final AI Output only)
  let md = `# AI Session Log\n\n`;
  md += `- **Conversation ID**: \`${conversationId}\`\n`;
  md += `- **Last Updated**: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n`;
  md += `- **Model**: ${hookContext.modelName || 'auto'}\n`;
  md += `- **Total Turns**: ${turns.length}\n\n`;
  md += `---\n\n`;

  turns.forEach((turn, idx) => {
    md += `## Turn ${idx + 1}\n\n`;
    md += `### 👤 Prompt:\n\n${turn.prompt || '*(Empty prompt)*'}\n\n`;

    if (turn.response) {
      md += `### 🤖 AI Output:\n\n${turn.response}\n\n`;
    } else {
      md += `### 🤖 AI Output:\n\n*(Lượt này chưa có output hoặc bị gián đoạn)*\n\n`;
    }

    md += `---\n\n`;
  });

  const sessionFile = path.join(outputDir, `session-${conversationId.slice(0, 8)}.md`);
  const latestFile = path.join(outputDir, `latest.md`);

  fs.writeFileSync(sessionFile, md, 'utf8');
  fs.writeFileSync(latestFile, md, 'utf8');
}

main()
  .catch(() => {})
  .finally(() => {
    finishHook();
    process.exit(0);
  });
