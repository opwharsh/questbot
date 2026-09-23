import {
    GatewayDispatchEvents,
    GatewayIntentBits,
    InteractionType,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ComponentType,
    ButtonStyle,
    TextInputStyle,
} from "discord-api-types/v10";
import { Client } from "@discordjs/core";
import { noPrefixCommand } from "./noprefix";
import { REST } from "@discordjs/rest";
import { WebSocketManager } from "@discordjs/ws";
import { runQuestsForToken, fetchQuestsStatus } from "./src/questRunner";
import type { Quest, QuestStatusInfo } from "./src/questRunner";
import { setStatus, setCustomStatuses } from "./status.js";
import { serversCommand } from "./servers";
import { leaveGuildCommand } from "./leaveguild";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is required.");
    process.exit(1);
}
if (!CLIENT_ID) {
    console.error("CLIENT_ID is required.");
    process.exit(1);
}

let PREFIX = "!";
const NO_PREFIX_USERS = new Set<string>();

const OWNER_ID = "867633787529986048";
const AVATAR_COOLDOWN = 5000;
let lastAvatarEdit = 0;

const INTENTS =
    GatewayIntentBits.Guilds |
    GatewayIntentBits.GuildMessages |
    GatewayIntentBits.MessageContent |
    GatewayIntentBits.DirectMessages;

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
const gateway = new WebSocketManager({
    token: BOT_TOKEN,
    intents: INTENTS,
    rest,
});
const client = new Client({ rest, gateway });

// ── Custom IDs ────────────────────────────────────────────────────────────────
const BTN_RUN = "quest_run_btn";
const BTN_STATUS = "quest_status_btn";
const MODAL_RUN = "quest_run_modal";
const MODAL_STATUS = "quest_status_modal";
const INPUT_TOKEN = "user_token_input";

// ── Helpers ───────────────────────────────────────────────────────────────────
const TASK_LABELS: Record<string, string> = {
    WATCH_VIDEO: "📺 Watch Video",
    WATCH_VIDEO_ON_MOBILE: "📱 Watch Video on Mobile",
    PLAY_ON_DESKTOP: "🖥️ Play on Desktop",
    PLAY_ON_XBOX: "🎮 Play on Xbox",
    PLAY_ON_PLAYSTATION: "🎮 Play on PlayStation",
    PLAY_ACTIVITY: "🎯 Play Activity",
    ACHIEVEMENT_IN_ACTIVITY: "🏆 Achievement",
    STREAM_ON_DESKTOP: "📡 Stream on Desktop",
};

function makeBar(pct: number, len = 12): string {
    const filled = Math.round((pct / 100) * len);
    return "█".repeat(filled) + "░".repeat(len - filled);
}

// ── "Token Required" embed + buttons ─────────────────────────────────────────
function buildTokenRequiredEmbed() {
    return {
        embeds: [
            {
                color: 0xfaa61a,
                title: "🔗 Token Required",
                description:
                    "You need to link your Discord token before using quest commands.\n\n" +
                    "Click **Link Token** below — a popup will appear right here in Discord " +
                    "where you can paste your token. No DMs needed.",
                fields: [
                    {
                        name: "How to get your token:",
                        value:
                            "1. Open Discord in your **browser** (not the app)\n" +
                            "2. Press `Ctrl+Shift+I` → **Network** tab → filter `XHR`\n" +
                            "3. Send any message, click the request, find `Authorization` in the headers\n" +
                            "4. Copy that value and paste it into the popup",
                    },
                    {
                        name: "⚠️ Warning",
                        value: "This is your **user token**, NOT your bot token.",
                    },
                ],
            },
        ],
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        custom_id: BTN_RUN,
                        label: "Link Token",
                        emoji: { name: "🔗" },
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        custom_id: BTN_STATUS,
                        label: "Check Status",
                        emoji: { name: "📋" },
                    },
                ],
            },
        ],
    };
}

// ── Token modal ───────────────────────────────────────────────────────────────
function buildTokenModal(customId: string, title: string) {
    return {
        title,
        custom_id: customId,
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.TextInput,
                        style: TextInputStyle.Short,
                        custom_id: INPUT_TOKEN,
                        label: "Your Discord user token",
                        placeholder:
                            "Paste your token here — it starts with your ID",
                        required: true,
                        min_length: 20,
                    },
                ],
            },
        ],
    };
}

// ── Build "Quest Complete" embed ──────────────────────────────────────────────
function buildCompleteEmbed(quest: Quest) {
    const cfg = quest.config;
    const questName = cfg.messages.quest_name;
    const gameTitle = cfg.messages.game_title;
    const publisher = cfg.messages.game_publisher;
    const appId = cfg.application.id;
    const color =
        parseInt((cfg.colors?.primary ?? "#57F287").replace("#", ""), 16) ||
        0x57f287;

    const tasks = cfg.task_config_v2?.tasks ?? {};
    const taskLines = Object.entries(tasks)
        .map(
            ([k, v]: [string, any]) =>
                `${TASK_LABELS[k] ?? k} • ${Math.ceil((v?.target ?? 0) / 60)} min ✓`,
        )
        .join("\n");

    const expiresAt = new Date(cfg.expires_at);
    const expiresUnix = Math.floor(expiresAt.getTime() / 1000);
    const daysLeft = Math.max(
        0,
        Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000),
    );

    const rewards = cfg.rewards_config?.rewards ?? [];
    const rewardLines = (rewards as any[])
        .map((r: any) =>
            r.orb_quantity
                ? `${r.orb_quantity} Orbs ✦ (${r.messages?.name ?? ""})`
                : (r.messages?.name ?? ""),
        )
        .join("\n");

    const gameTile = cfg.assets?.game_tile;
    const thumbnail = gameTile
        ? {
              url: `https://media.discordapp.net/app-assets/${appId}/store/${gameTile}.png`,
          }
        : undefined;

    const embed: any = {
        color,
        title: "<:Verified:1519754442562339080> Quest Complete!",
        description: `**${questName}**\n*${gameTitle} • ${publisher}*`,
        fields: [
            { name: "📋 Task", value: taskLines || "Unknown", inline: false },
            {
                name: "📅 Expires",
                value: `<t:${expiresUnix}:R> (${daysLeft}d left)`,
                inline: true,
            },
            {
                name: "📊 Progress",
                value: `\`${makeBar(100)}\`  100% — Done!`,
                inline: true,
            },
        ],
    };
    if (rewardLines)
        embed.fields.push({
            name: "🎁 Reward",
            value: rewardLines,
            inline: false,
        });
    if (thumbnail) embed.thumbnail = thumbnail;
    return embed;
}

// ── Build "Quest Status" embed (one per quest) ────────────────────────────────
function buildStatusEmbed(info: QuestStatusInfo) {
    const color = parseInt(info.colorHex, 16) || 0x5865f2;
    const taskLabel = TASK_LABELS[info.taskName] ?? info.taskName;
    const targetMins = Math.ceil(info.targetSeconds / 60);
    const doneMins = Math.ceil(info.doneSeconds / 60);
    const bar = makeBar(info.progressPct);
    const expiresUnix = Math.floor(info.expiresAt.getTime() / 1000);
    const daysLeft = Math.max(
        0,
        Math.ceil((info.expiresAt.getTime() - Date.now()) / 86_400_000),
    );

    const statusIcon = info.isCompleted ? "✅" : info.isEnrolled ? "🔄" : "🆕";
    const statusText = info.isCompleted
        ? "Completed"
        : info.isEnrolled
          ? "In Progress"
          : "Not Enrolled";

    const rewardText = info.orbQuantity
        ? `${info.orbQuantity} Orbs ✦ (${info.rewardName})`
        : info.rewardName;

    const thumbnail = info.gameTileAsset
        ? {
              url: `https://media.discordapp.net/app-assets/${info.appId}/store/${info.gameTileAsset}.png`,
          }
        : undefined;

    const embed: any = {
        color,
        title: `${statusIcon} ${info.name}`,
        description: `*${info.gameTitle} • ${info.publisher}*`,
        fields: [
            {
                name: "📋 Task",
                value: `${taskLabel} • ${targetMins} min`,
                inline: false,
            },
            {
                name: "📊 Progress",
                value: `\`${bar}\`  ${info.progressPct}% (${doneMins}/${targetMins} min) — ${statusText}`,
                inline: false,
            },
            {
                name: "📅 Expires",
                value: `<t:${expiresUnix}:R> (${daysLeft}d left)`,
                inline: true,
            },
            { name: "🎁 Reward", value: rewardText, inline: true },
        ],
    };
    if (thumbnail) embed.thumbnail = thumbnail;
    return embed;
}

// ── Format error messages ─────────────────────────────────────────────────────
function formatError(err: string): string {
    const blockedMatch = err.match(/blocked until (.+?)\.?$/i);
    if (blockedMatch) {
        const unixTs = Math.floor(new Date(blockedMatch[1]).getTime() / 1000);
        if (!isNaN(unixTs)) {
            return `🚫 **Quest enrollment blocked!**\nDiscord ne temporarily block kar diya hai.\n\n**Unblock hoga:** <t:${unixTs}:F> (<t:${unixTs}:R>)`;
        }
    }
    if (
        /401|unauthorized/i.test(err) ||
        /invalid.*token|token.*invalid/i.test(err)
    ) {
        return [
            "🔑 **Invalid or expired token!**",
            "The token is incorrect or has expired.",
            "",
            "**How to get a token?**",
            "Check tutorials given in the channel.",
        ].join("\n");
    }
    if (/token is required/i.test(err)) {
        return "❌ **did not give token!** Command ke saath apna Discord token do.";
    }
    if (/rate.?limit/i.test(err)) {
        return "⏱️ **Rate limited!** Discord ne temporarily block kar diya — thodi der baad try karo.";
    }
    return `❌ **Error:** \`${err}\``;
}

// ── Send quest complete embed ─────────────────────────────────────────────────
async function sendQuestEmbed(channelId: string, quest: Quest) {
    await rest
        .post(`/channels/${channelId}/messages` as any, {
            body: { embeds: [buildCompleteEmbed(quest)] },
        })
        .catch((e: any) =>
            console.error("Failed to send quest embed:", e.message),
        );
}

// ── Send status embeds ────────────────────────────────────────────────────────
async function sendStatusEmbeds(
    channelId: string,
    token: string,
    mentionUser?: string,
) {
    const working = (await rest
        .post(`/channels/${channelId}/messages` as any, {
            body: {
                content: `${mentionUser ? `<@${mentionUser}> ` : ""}⏳ Quest status fetch ho rahi hai...`,
            },
        })
        .catch(() => null)) as any;

    const { quests, error } = await fetchQuestsStatus(token);

    if (error) {
        await rest
            .patch(`/channels/${channelId}/messages/${working?.id}` as any, {
                body: {
                    content: `${mentionUser ? `<@${mentionUser}> ` : ""}${formatError(error)}`,
                },
            })
            .catch(() => {});
        return;
    }

    if (working?.id) {
        await rest
            .delete(`/channels/${channelId}/messages/${working.id}` as any)
            .catch(() => {});
    }

    if (quests.length === 0) {
        await rest
            .post(`/channels/${channelId}/messages` as any, {
                body: {
                    content: `${mentionUser ? `<@${mentionUser}> ` : ""}😴 Koi active quest nahi mili!`,
                },
            })
            .catch(() => {});
        return;
    }

    await rest
        .post(`/channels/${channelId}/messages` as any, {
            body: {
                content: `${mentionUser ? `<@${mentionUser}> ` : ""}📋 **${quests.length} quest(s) mili — current status:**`,
            },
        })
        .catch(() => {});

    for (const info of quests) {
        await rest
            .post(`/channels/${channelId}/messages` as any, {
                body: { embeds: [buildStatusEmbed(info)] },
            })
            .catch(() => {});
    }
}

// ── Register slash commands ───────────────────────────────────────────────────
async function registerCommands() {
    await rest.put(`/applications/${CLIENT_ID}/commands` as any, {
        body: [
            {
                name: "run-quests",
                description:
                    "Auto-complete your Discord quests using your user token",
                options: [
                    {
                        name: "token",
                        description:
                            "Your Discord user token (reply is private)",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                ],
            },
            {
                name: "quest-status",
                description:
                    "Check your active quests and progress without completing them",
                options: [
                    {
                        name: "token",
                        description:
                            "Your Discord user token (reply is private)",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                ],
            },
        ],
    });
    console.log(
        "Slash commands /run-quests, /quest-status registered globally.",
    );
}

// ── Core run + report helper ──────────────────────────────────────────────────
async function runAndReport(
    userToken: string,
    channelId: string,
    sendInitial: () => Promise<any>,
    editFinal: (content: string) => Promise<void>,
) {
    await sendInitial();

    const result = await runQuestsForToken(userToken, (quest) =>
        sendQuestEmbed(channelId, quest),
    ).catch((err: any) => ({
        output: "",
        error: err.message ?? String(err),
        questsFound: 0,
        questsCompleted: 0,
    }));

    let content: string;
    if (result.error) {
        content = formatError(result.error);
    } else if (result.questsFound === 0) {
        content = "😴 I don't have any active quests now!";
    } else {
        content = `✅ **${result.questsFound}** quest(s) mili — **${result.questsCompleted}** complete!`;
    }

    await editFinal(content.slice(0, 2000));
}

// ── Cooldown system ───────────────────────────────────────────────────────────
const COOLDOWN_MS = 60_000;
const activeUsers = new Set<string>();
const lastRunAt = new Map<string, number>();

function checkCooldown(userId: string): { blocked: boolean; reason?: string } {
    if (activeUsers.has(userId)) {
        return {
            blocked: true,
            reason: "⏳ Your quest is already running, wait!",
        };
    }
    const last = lastRunAt.get(userId);
    if (last) {
        const elapsed = Date.now() - last;
        if (elapsed < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
            return {
                blocked: true,
                reason: `⏱️ Cooldown! **${left}s** baad try karo.`,
            };
        }
    }
    return { blocked: false };
}

function startRun(userId: string) {
    activeUsers.add(userId);
    lastRunAt.set(userId, Date.now());
}
function finishRun(userId: string) {
    activeUsers.delete(userId);
}

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
    console.log(`Bot logged in as @${data.user.username} (${data.user.id})`);

    setStatus(client);

    await registerCommands().catch((e) =>
        console.error("Failed to register commands:", e.message),
    );
    console.log(`Prefix command: "${PREFIX}" → shows Link Token button`);
});

// ── Interactions (slash commands + buttons + modals) ──────────────────────────
client.on(
    GatewayDispatchEvents.InteractionCreate,
    async ({ data: interaction, api }) => {
        const channelId =
            (interaction as any).channel_id ?? interaction.channel?.id ?? "";
        const userId =
            (interaction as any).member?.user?.id ??
            (interaction as any).user?.id ??
            "";

        // ── Button clicks ─────────────────────────────────────────────────────────
        if (interaction.type === InteractionType.MessageComponent) {
            const customId = (interaction.data as any)?.custom_id as string;

            if (customId === BTN_RUN) {
                const cd = checkCooldown(userId);
                if (cd.blocked) {
                    await api.interactions.reply(
                        interaction.id,
                        interaction.token,
                        {
                            content: cd.reason!,
                            flags: 64,
                        },
                    );
                    return;
                }
                await api.interactions.createModal(
                    interaction.id,
                    interaction.token,
                    buildTokenModal(MODAL_RUN, "Run Quests") as any,
                );
                return;
            }

            if (customId === BTN_STATUS) {
                await api.interactions.createModal(
                    interaction.id,
                    interaction.token,
                    buildTokenModal(MODAL_STATUS, "Check Quest Status") as any,
                );
                return;
            }
            return;
        }

        // ── Modal submits ─────────────────────────────────────────────────────────
        if (interaction.type === InteractionType.ModalSubmit) {
            const customId = (interaction.data as any)?.custom_id as string;
            const components = (interaction.data as any)?.components as any[];
            const userToken =
                components?.[0]?.components?.[0]?.value?.trim() ?? "";

            if (!userToken) {
                await api.interactions.reply(
                    interaction.id,
                    interaction.token,
                    {
                        content: "❌ I did not get the token. Try again.",
                        flags: 64,
                    },
                );
                return;
            }

            // Modal: Check Status
            if (customId === MODAL_STATUS) {
                await api.interactions.defer(
                    interaction.id,
                    interaction.token,
                    { flags: 64 },
                );
                console.log(`[Modal status] started (user: ${userId})`);
                await sendStatusEmbeds(channelId, userToken);
                await api.interactions.editReply(
                    CLIENT_ID!,
                    interaction.token,
                    {
                        content: "📋 Status embeds sent above!",
                    },
                );
                return;
            }

            // Modal: Run Quests
            if (customId === MODAL_RUN) {
                const cd = checkCooldown(userId);
                if (cd.blocked) {
                    await api.interactions.reply(
                        interaction.id,
                        interaction.token,
                        {
                            content: cd.reason!,
                            flags: 64,
                        },
                    );
                    return;
                }

                await api.interactions.defer(
                    interaction.id,
                    interaction.token,
                    { flags: 64 },
                );
                const sendInitial = async () =>
                    api.interactions.editReply(CLIENT_ID!, interaction.token, {
                        content: "⏳ Quest processing has started...",
                    });
                const editFinal = async (c: string) =>
                    void (await api.interactions.editReply(
                        CLIENT_ID!,
                        interaction.token,
                        { content: c },
                    ));

                console.log(`[Modal run] started (user: ${userId})`);
                startRun(userId);
                try {
                    await runAndReport(
                        userToken,
                        channelId,
                        sendInitial,
                        editFinal,
                    );
                } finally {
                    finishRun(userId);
                }
                return;
            }
            return;
        }

        // ── Slash commands ────────────────────────────────────────────────────────
        if (interaction.type !== InteractionType.ApplicationCommand) return;
        const cmdData = interaction.data as any;
        if (cmdData?.type !== ApplicationCommandType.ChatInput) return;

        const userToken: string | undefined = cmdData.options?.find(
            (o: any) => o.name === "token",
        )?.value;

        if (!userToken?.trim()) {
            await api.interactions.reply(interaction.id, interaction.token, {
                content: "❌ Token is required.",
                flags: 64,
            });
            return;
        }

        if (cmdData?.name === "quest-status") {
            await api.interactions.defer(interaction.id, interaction.token, {
                flags: 64,
            });
            console.log(`[Slash /quest-status] started`);
            await sendStatusEmbeds(channelId, userToken.trim());
            await api.interactions.editReply(CLIENT_ID!, interaction.token, {
                content: "📋 Status embeds sent above!",
            });
            return;
        }

        if (cmdData?.name === "run-quests") {
            const cd = checkCooldown(userId);
            if (cd.blocked) {
                await api.interactions.reply(
                    interaction.id,
                    interaction.token,
                    { content: cd.reason!, flags: 64 },
                );
                return;
            }
            await api.interactions.defer(interaction.id, interaction.token, {
                flags: 64,
            });
            const sendInitial = async () =>
                api.interactions.editReply(CLIENT_ID!, interaction.token, {
                    content: "⏳ Quest processing has started...",
                });
            const editFinal = async (c: string) =>
                void (await api.interactions.editReply(
                    CLIENT_ID!,
                    interaction.token,
                    { content: c },
                ));
            console.log(`[Slash /run-quests] started (user: ${userId})`);
            startRun(userId);
            try {
                await runAndReport(
                    userToken.trim(),
                    channelId,
                    sendInitial,
                    editFinal,
                );
            } finally {
                finishRun(userId);
            }
            return;
        }
    },
);

// ── Prefix: !quest → shows embed with buttons ─────────────────────────────────
client.on(
    GatewayDispatchEvents.MessageCreate,
    async ({ data: message, api }) => {
        if (message.author.bot) return;
        const raw = message.content?.trim() ?? "";
        
if (raw.toLowerCase() === "!servers") {
    if (message.author.id !== OWNER_ID) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ You don't have permission to use this command.",
            message_reference: { message_id: message.id },
        });
        return;
    }

    await serversCommand(api, message);
    return;
}

if (raw.toLowerCase().startsWith("!leave guild ")) {
    if (message.author.id !== OWNER_ID) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ You don't have permission to use this command.",
            message_reference: { message_id: message.id },
        });
        return;
    }

    const guildId = raw.slice("!leave guild ".length).trim();

    await leaveGuildCommand(api, message, guildId);
    return;
}
        
if (
  raw.toLowerCase().startsWith("!edit avatar ") ||
  raw.toLowerCase().startsWith("!edit banner ")
) {
    if (message.author.id !== OWNER_ID) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ You don't have permission to use this command.",
            message_reference: { message_id: message.id },
        });
        return;
    }

    const now = Date.now();

    if (now - lastAvatarEdit < AVATAR_COOLDOWN) {
        const remaining = Math.ceil(
            (AVATAR_COOLDOWN - (now - lastAvatarEdit)) / 1000
        );

        await api.channels.createMessage(message.channel_id, {
            content: `⏳ Please wait ${remaining}s before changing the profile again.`,
            message_reference: { message_id: message.id },
        });
        return;
    }

    const isBanner = raw.toLowerCase().startsWith("!edit banner ");
    const command = isBanner ? "!edit banner " : "!edit avatar ";
    const imageUrl = raw.slice(command.length).trim();

    if (!imageUrl) {
        await api.channels.createMessage(message.channel_id, {
            content: `❌ Usage: \`${command}<image URL>\``,
            message_reference: { message_id: message.id },
        });
        return;
    }

    try {
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error("Could not fetch image.");
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.startsWith("image/")) {
            throw new Error("URL is not an image.");
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const base64 = buffer.toString("base64");
        const imageData = `data:${contentType};base64,${base64}`;

        if (isBanner) {
            await api.users.edit({
                banner: imageData,
            });
        } else {
            await api.users.edit({
                avatar: imageData,
            });
        }

        lastAvatarEdit = Date.now();

        await api.channels.createMessage(message.channel_id, {
            content: isBanner
                ? "✅ Bot banner updated globally."
                : "✅ Bot avatar updated globally.",
            message_reference: { message_id: message.id },
        });
    } catch (error) {
        console.error("Profile update error:", error);

        await api.channels.createMessage(message.channel_id, {
            content: "❌ Failed to update the image. Make sure the URL is a valid image.",
            message_reference: { message_id: message.id },
        });
    }

    return;
}
        // !status <status1>, <status2>, <status3>
if (raw.toLowerCase().startsWith("!status ")) {
    if (message.author.id !== OWNER_ID) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ You don't have permission to use this command.",
            message_reference: { message_id: message.id },
        });
        return;
    }

    const statusText = raw.slice("!status ".length).trim();

    if (!statusText) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ Usage: `!status status 1, status 2, status 3`",
            message_reference: { message_id: message.id },
        });
        return;
    }

    const newStatuses = statusText
        .split(",")
        .map((status) => status.trim())
        .filter(Boolean);

    await setCustomStatuses(newStatuses);

    await api.channels.createMessage(message.channel_id, {
        content: `✅ Statuses updated.\n\n${newStatuses
            .map((status, index) => `${index + 1}. ${status}`)
            .join("\n")}`,
        message_reference: { message_id: message.id },
    });

    return;
}
       
        // !prefix <new prefix> — owner only
if (raw.toLowerCase().startsWith("!prefix ")) {
    if (message.author.id !== OWNER_ID) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ You don't have permission to use this command.",
            message_reference: { message_id: message.id },
        });
        return;
    }

    const newPrefix = raw.slice("!prefix ".length).trim();

    if (!newPrefix) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ Usage: `!prefix <new prefix>`",
            message_reference: { message_id: message.id },
        });
        return;
    }

    if (newPrefix.length > 3) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ Prefix can only be 1–3 characters long.",
            message_reference: { message_id: message.id },
        });
        return;
    }

    PREFIX = newPrefix;

    await api.channels.createMessage(message.channel_id, {
        content: `✅ Prefix changed to \`${PREFIX}\``,
        message_reference: { message_id: message.id },
    });

    return;
}
        
      if (!raw.toLowerCase().startsWith(PREFIX.toLowerCase())) return;

let args = raw.slice(PREFIX.length).trim();

if (!args.toLowerCase().startsWith("quest")) return;

args = args.slice("quest".length).trim();

        // !quest status <token>  — legacy direct token support kept
        if (args.toLowerCase().startsWith("status ")) {
            const token = args.slice("status ".length).trim();
            if (!token) {
                await api.channels.createMessage(message.channel_id, {
                    content: "❌ I want a token: `!quest status <token>`",
                    message_reference: { message_id: message.id },
                });
                return;
            }
            await api.channels
                .deleteMessage(message.channel_id, message.id)
                .catch(() => {});
            console.log(
                `[Prefix status] started (channel: ${message.channel_id})`,
            );
            await sendStatusEmbeds(
                message.channel_id,
                token,
                message.author.id,
            );
            return;
        }

        // !quest <token>  — legacy direct token kept for power users
        if (args && args !== "help") {
            const userId = message.author.id;
            const cd = checkCooldown(userId);
            if (cd.blocked) {
                await api.channels.createMessage(message.channel_id, {
                    content: `<@${userId}> ${cd.reason}`,
                    message_reference: { message_id: message.id },
                });
                return;
            }

            const token = args;
            await api.channels
                .deleteMessage(message.channel_id, message.id)
                .catch(() => {});
            const sentMsg = await api.channels.createMessage(
                message.channel_id,
                {
                    content: `⏳ <@${userId}> ⏳ Quest processing has started...`,
                },
            );
            const editFinal = async (txt: string) => {
                await api.channels
                    .editMessage(message.channel_id, sentMsg.id, {
                        content: `<@${userId}> ${txt}`,
                    })
                    .catch(() => {});
            };
            console.log(`[Prefix run] started (user: ${userId})`);
            startRun(userId);
            try {
                await runAndReport(
                    token,
                    message.channel_id,
                    async () => {},
                    editFinal,
                );
            } finally {
                finishRun(userId);
            }
            return;
        }

        // !quest  or  !quest help  → show embed + buttons
        await api.channels.createMessage(message.channel_id, {
            ...(buildTokenRequiredEmbed() as any),
            message_reference: { message_id: message.id },
        });
    },
);

// ── Error handling ────────────────────────────────────────────────────────────
process.on("unhandledRejection", (r) =>
    console.error("[Error] Unhandled Rejection:", r),
);
process.on("uncaughtException", (e) =>
    console.error("[Error] Uncaught Exception:", e.message),
);

gateway.connect();
