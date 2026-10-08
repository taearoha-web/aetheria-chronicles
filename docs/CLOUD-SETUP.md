# Continue from mobile while the PC is off

## Connection status must be verified

The repository is `https://github.com/taearoha-web/aetheria-chronicles`. Source storage, game hosting and a Codex Cloud environment are separate setup steps. This guide is not evidence that hosting or cloud execution has been activated.

## One-time GitHub access

Open the official [ChatGPT Codex Connector](https://github.com/apps/chatgpt-codex-connector/installations/new), choose the repository owner account, grant access to the intended repository, then finish GitHub's Install/Save flow. Keep the repository private if that is the owner's preference. No API token needs to be pasted into chat.

After access is enabled, verify repository metadata through the connector, upload the complete source and embedded assets, and inspect the resulting commit and workflow run. Do not mark this complete on the basis of a successful account login alone.

## Codex Cloud

Official instructions: [Run coding tasks in the cloud](https://learn.chatgpt.com/docs/cloud).

1. On ChatGPT web or desktop, select **Work in → Cloud → Select environment → Create environment**.
2. Select `taearoha-web/aetheria-chronicles` and let Codex prepare the environment.
3. Use Node 22+, installation `npm ci`, verification `npm run check`, and a preview command `npm run dev -- --host 0.0.0.0`.
4. Inspect the setup and test results, then publish the environment and verify **Environment published**.
5. On mobile, open Codex and select that cloud environment before sending a development request.

Example request:

> พัฒนา Aetheria Chronicles ต่อจากโค้ดล่าสุด อ่าน AGENTS.md ก่อน เพิ่ม [รายละเอียด] รักษาเซฟเดิม ทดสอบบนขนาดจอ iPhone และเปิด PR พร้อมสรุปผลทดสอบ

The repository's `AGENTS.md` retains the owner's game rules and validation requirements. A GitHub issue records work but does not, by itself, automatically start Codex. No autonomous paid API agent is configured in this project.

## Playable link

`Build and test` produces a web build artifact. To obtain a public HTTPS game URL, enable a suitable static host. The supplied `Publish playable game` workflow supports GitHub Pages after account eligibility and repository settings are ready. A private source repository does not automatically imply a private Pages website. Confirm the intended audience before publishing.
