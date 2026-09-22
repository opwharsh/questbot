const OWNER_ID = "867633787529986048";

export async function serversCommand(
    api: any,
    message: any
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

    try {
        const result = await api.users.getGuilds();
        const guilds = result;

        if (!guilds || guilds.length === 0) {
            await api.channels.createMessage(message.channel_id, {
                content: "❌ No servers found.",
                message_reference: {
                    message_id: message.id,
                },
            });
            return;
        }

        const lines = guilds.map(
            (guild: any, index: number) =>
                `**${index + 1}. ${guild.name ?? "Unknown Server"}**\n\`${guild.id}\``
        );

        let chunk = `📊 **Questify is in ${guilds.length} server(s)**\n\n`;

        for (const line of lines) {
            if ((chunk + line + "\n\n").length > 1900) {
                await api.channels.createMessage(message.channel_id, {
                    content: chunk,
                    message_reference: {
                        message_id: message.id,
                    },
                });

                chunk = "";
            }

            chunk += line + "\n\n";
        }

        if (chunk.trim()) {
            await api.channels.createMessage(message.channel_id, {
                content: chunk,
                message_reference: {
                    message_id: message.id,
                },
            });
        }
    } catch (error) {
        console.error("Servers command error:", error);

        await api.channels.createMessage(message.channel_id, {
            content: "❌ Failed to fetch the server list.",
            message_reference: {
                message_id: message.id,
            },
        });
    }
}
