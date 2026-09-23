const OWNER_ID = "867633787529986048";

const NO_PREFIX_USERS = new Set<string>();

// Check if a user has no-prefix access
export function hasNoPrefix(userId: string): boolean {
    return NO_PREFIX_USERS.has(userId);
}

export async function noPrefixCommand(
    api: any,
    message: any,
    args: string
) {
    if (message.author.id !== OWNER_ID) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ You don't have permission to use this command.",
            message_reference: {
                message_id: message.id,
            },
        });
        return;
    }

    const parts = args.trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();
    const userInput = parts[1];

    // !noprefix list
    if (action === "list") {
        if (NO_PREFIX_USERS.size === 0) {
            await api.channels.createMessage(message.channel_id, {
                content: "📋 No users currently have no-prefix access.",
                message_reference: {
                    message_id: message.id,
                },
            });
            return;
        }

        const users = [...NO_PREFIX_USERS]
            .map((id, index) => `${index + 1}. <@${id}> — \`${id}\``)
            .join("\n");

        await api.channels.createMessage(message.channel_id, {
            content: `📋 **No-Prefix Users**\n\n${users}`,
            message_reference: {
                message_id: message.id,
            },
        });

        return;
    }

    // !noprefix add/remove @user
    if (!["add", "remove"].includes(action) || !userInput) {
        await api.channels.createMessage(message.channel_id, {
            content:
                "❌ Usage:\n`!noprefix add @user`\n`!noprefix remove @user`\n`!noprefix list`",
            message_reference: {
                message_id: message.id,
            },
        });
        return;
    }

    const userId = userInput.replace(/[<@!>]/g, "");

    if (!/^\d{17,20}$/.test(userId)) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ Please mention a valid Discord user.",
            message_reference: {
                message_id: message.id,
            },
        });
        return;
    }

    if (action === "add") {
        NO_PREFIX_USERS.add(userId);

        await api.channels.createMessage(message.channel_id, {
            content: `✅ <@${userId}> can now use Questify without a prefix.`,
            message_reference: {
                message_id: message.id,
            },
        });
    } else {
        NO_PREFIX_USERS.delete(userId);

        await api.channels.createMessage(message.channel_id, {
            content: `✅ Removed no-prefix access from <@${userId}>.`,
            message_reference: {
                message_id: message.id,
            },
        });
    }
}
