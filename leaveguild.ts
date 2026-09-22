const OWNER_ID = "867633787529986048";

export async function leaveGuildCommand(
    api: any,
    message: any,
    guildId: string
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

    if (!guildId) {
        await api.channels.createMessage(message.channel_id, {
            content: "❌ Usage: `!leave guild <server ID>`",
            message_reference: {
                message_id: message.id,
            },
        });
        return;
    }

    try {
        await api.users.leaveGuild(guildId);

        await api.channels.createMessage(message.channel_id, {
            content: `✅ Successfully left the server \`${guildId}\`.`,
            message_reference: {
                message_id: message.id,
            },
        });
    } catch (error) {
        console.error("Leave guild error:", error);

        await api.channels.createMessage(message.channel_id, {
            content: `❌ I couldn't leave \`${guildId}\`. Make sure the ID is correct and the bot is in that server.`,
            message_reference: {
                message_id: message.id,
            },
        });
    }
}
