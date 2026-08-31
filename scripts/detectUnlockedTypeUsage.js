const fs = require('fs');
const path = require('path');
const https = require('./utils/https');
const getCliArgs = require('./utils/getCliArgs');

const TYPE_NAME = 'SnapTemplatesConfigUnlocked';
// snap 1.12.0+ (https://github.com/AthosCommerce/snap/commit/cc4e3d016b33074fe8242a7b7ea3c625e2c8708b)
// added validateTemplatesConfig/validateTemplatesConfigUnlocked helpers as the
// recommended way to type a config, replacing the `: SnapTemplatesConfigUnlocked`
// annotation. Detect either so older and newer templates repos both work.
const VALIDATE_FUNCTION_NAME = 'validateTemplatesConfigUnlocked';
const ARTIFACT_NAME = 'unlocked-production';
const SLACK_SUBTEAM = '<!subteam^S010K9M9XJ6>';
const FREEZE_POLICE_GIFS = [
	'https://media.giphy.com/media/RYjnzPS8u0jAs/giphy.gif',
	'https://media.giphy.com/media/x0GeFXErpcRk4/giphy.gif',
	'https://media.giphy.com/media/3ohs4epCEN04wskff2/giphy.gif',
	'https://media.giphy.com/media/130o0AYCKPZ1ZK/giphy.gif',
	'https://media.giphy.com/media/2GMMLbVSGfjQjquMWI/giphy.gif',
	'https://media.giphy.com/media/B1TMcmoBAaSZi/giphy.gif',
	'https://media.giphy.com/media/M90xthrdOuTlGncaoK/giphy.gif',
];

// ---------------------------------------------------------------------------
// Detection (inlined from the former scripts/utils/detectUnlockedTypeUsage.js)
// ---------------------------------------------------------------------------

function walk(dir) {
	let results = [];
	const list = fs.readdirSync(dir);
	for (const file of list) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat && stat.isDirectory()) {
			results = results.concat(walk(filePath));
		} else {
			results.push(filePath);
		}
	}
	return results;
}

// Returns 'unlocked' | 'locked' | 'unknown'
function detectUnlocked() {
	try {
		const srcDir = path.join(process.cwd(), 'src');
		if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) return 'unknown';
		const files = walk(srcDir).filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && path.basename(f) !== 'types.d.ts');
		// Matches either the old `: SnapTemplatesConfigUnlocked` type annotation or a
		// call/import of the new validateTemplatesConfigUnlocked() helper.
		const regex = new RegExp(`\\b(${TYPE_NAME}|${VALIDATE_FUNCTION_NAME})\\b`);
		for (const file of files) {
			if (regex.test(fs.readFileSync(file, 'utf8'))) return 'unlocked';
		}
		return 'locked';
	} catch {
		return 'unknown';
	}
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

// Parses the `--secrets-ci` arg (toJSON(secrets)) into an object keyed by secret name.
function getSecrets() {
	const args = getCliArgs(['secrets-ci']);
	try {
		return JSON.parse(args['secrets-ci']);
	} catch (e) {
		console.log("Could not parse secrets. Please provide a 'secrets' parameter. Example: `secrets: ${{ toJSON(secrets) }}`");
		return {};
	}
}

function getContext() {
	const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
	const secrets = getSecrets();
	let pr = null;
	let repositoryName = repo;

	const eventPath = process.env.GITHUB_EVENT_PATH;
	if (eventPath && fs.existsSync(eventPath)) {
		try {
			const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
			if (event.pull_request) {
				pr = {
					number: event.pull_request.number,
					htmlUrl: event.pull_request.html_url,
					author: event.pull_request.user && event.pull_request.user.login,
				};
			}
			if (event.repository && event.repository.name) repositoryName = event.repository.name;
		} catch (e) {
			console.log(`Could not parse GITHUB_EVENT_PATH: ${e.message}`);
		}
	}

	return {
		owner,
		repo,
		repositoryName,
		commit: process.env.GITHUB_SHA,
		branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
		pr,
		token: process.env.GITHUB_TOKEN,
		botToken: process.env.GITHUB_BOT_TOKEN || process.env.GITHUB_TOKEN,
		slackToken: secrets.SLACK_BOT_TOKEN,
		slackChannel: secrets.SLACK_CHANNEL_ID,
	};
}

// ---------------------------------------------------------------------------
// GitHub REST helpers (artifact list / delete, PR comment)
// ---------------------------------------------------------------------------

function githubRequest({ token, method, path: apiPath, body }) {
	const payload = body ? JSON.stringify(body) : undefined;
	return https({
		hostname: 'api.github.com',
		path: apiPath,
		method,
		headers: {
			'User-Agent': 'snap-action',
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			Authorization: `Bearer ${token}`,
			...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
		},
		body: payload,
	});
}

async function listUnlockedArtifacts(ctx) {
	const matches = [];
	const perPage = 100;
	let page = 1;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const res = await githubRequest({
			token: ctx.token,
			method: 'GET',
			path: `/repos/${ctx.owner}/${ctx.repo}/actions/artifacts?per_page=${perPage}&page=${page}`,
		});
		if (res.status < 200 || res.status >= 300) {
			console.log(`Failed to list artifacts (status ${res.status}): ${JSON.stringify(res.data)}`);
			break;
		}
		const artifacts = (res.data && res.data.artifacts) || [];
		matches.push(...artifacts.filter((a) => a.name === ARTIFACT_NAME));
		if (artifacts.length < perPage) break;
		page += 1;
	}
	return matches;
}

async function deleteArtifacts(ctx, matches) {
	if (!matches.length) {
		console.log(`No '${ARTIFACT_NAME}' artifacts to delete.`);
		return;
	}
	for (const artifact of matches) {
		const res = await githubRequest({
			token: ctx.token,
			method: 'DELETE',
			path: `/repos/${ctx.owner}/${ctx.repo}/actions/artifacts/${artifact.id}`,
		});
		if (res.status >= 200 && res.status < 300) {
			console.log(`Deleted artifact '${ARTIFACT_NAME}' (id: ${artifact.id}).`);
		} else {
			console.log(`Failed to delete artifact id ${artifact.id} (status ${res.status}): ${JSON.stringify(res.data)}`);
		}
	}
}

async function postPrComment(ctx) {
	if (!ctx.pr) {
		console.log('No pull request context found. Skipping PR comment.');
		return;
	}
	const author = ctx.pr.author ? `@${ctx.pr.author}` : 'author';
	const randomGif = FREEZE_POLICE_GIFS[Math.floor(Math.random() * FREEZE_POLICE_GIFS.length)];
	const body = `Greetings ${author} - this PR includes unlocked configuration usage. If this is intentional, please add context in the PR description.\n\nThe Snap team has been notified for review.\n![freeze police](${randomGif})`;

	const res = await githubRequest({
		token: ctx.botToken,
		method: 'POST',
		path: `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.pr.number}/comments`,
		body: { body },
	});
	if (res.status >= 200 && res.status < 300) {
		console.log('Posted PR comment to author.');
	} else {
		console.log(`Failed to post PR comment (status ${res.status}): ${JSON.stringify(res.data)}`);
	}
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

async function postSlack(ctx, text) {
	if (!ctx.slackToken || !ctx.slackChannel) {
		console.log('Slack credentials not provided. Skipping Slack message.');
		return;
	}
	const payload = JSON.stringify({ channel: ctx.slackChannel, text });
	const res = await https({
		hostname: 'slack.com',
		path: '/api/chat.postMessage',
		method: 'POST',
		headers: {
			'User-Agent': 'snap-action',
			Authorization: `Bearer ${ctx.slackToken}`,
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Length': Buffer.byteLength(payload),
		},
		body: payload,
	});
	if (res.status >= 200 && res.status < 300 && res.data && res.data.ok) {
		console.log('Posted Slack message.');
	} else {
		console.log(`Failed to post Slack message (status ${res.status}): ${JSON.stringify(res.data)}`);
	}
}

// ---------------------------------------------------------------------------
// Artifact payload + upload
// ---------------------------------------------------------------------------

function writePayload(ctx) {
	const dir = path.join(process.cwd(), '.artifacts');
	fs.mkdirSync(dir, { recursive: true });
	const filePath = path.join(dir, `${ARTIFACT_NAME}.json`);
	const payload = {
		repository: ctx.repositoryName,
		branch: ctx.branch,
		commit: ctx.commit,
		unlocked: true,
		generatedAt: new Date().toISOString(),
	};
	fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
	return { dir, filePath };
}

// Signals the following action.yml step to upload the payload via
// actions/upload-artifact (the artifact runtime token is not available to this
// composite run step, so the upload itself must be a JavaScript action).
function signalUpload() {
	const out = process.env.GITHUB_OUTPUT;
	if (!out) {
		console.log('GITHUB_OUTPUT not set; skipping do_upload signal.');
		return;
	}
	fs.appendFileSync(out, 'do_upload=true\n');
	console.log('Signalled artifact upload (do_upload=true).');
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function main() {
	const state = detectUnlocked();
	console.log(`Unlocked detection result: ${state}`);
	const ctx = getContext();

	if (state === 'unknown') {
		await postSlack(ctx, ':warning: An unknown error has occurred while detecting unlocked configuration.' + (ctx.pr ? `\n${ctx.pr.htmlUrl}` : ''));
		return;
	}

	if (state === 'locked') {
		const matches = await listUnlockedArtifacts(ctx);
		await deleteArtifacts(ctx, matches);
		return;
	}

	// state === 'unlocked'
	const existing = await listUnlockedArtifacts(ctx);
	if (existing.length) {
		console.log(`Artifact '${ARTIFACT_NAME}' already exists. Skipping upload and notifications.`);
		return;
	}

	writePayload(ctx);
	signalUpload();
	await postSlack(
		ctx,
		`:rotating_light::unlock: *Unlocked configuration detected!*\n${ctx.pr ? ctx.pr.htmlUrl : ''}\n\n${SLACK_SUBTEAM} please review and confirm.`
	);
	await postPrComment(ctx);
}

main()
	.catch((e) => {
		console.log(`non-blocking: unlocked artifact management failed: ${e && e.stack ? e.stack : e}`);
	})
	.finally(() => {
		// Always succeed — this step must never fail the action.
		process.exit(0);
	});
