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
                content: "❌ Questify isn't in any servers.",
                message_reference: {
                    message_id: message.id,
                },
            });
            return;
        }

        for (const guild of guilds) {
            let ownerUsername = "Unknown";
            let ownerId = guild.owner_id ?? "Unknown";
            let ownerAvatar = "";

            // Get server owner information
            if (guild.owner_id) {
                try {
                    const owner = await api.users.get(guild.owner_id);

                    ownerUsername = owner.global_name
                        ? `${owner.global_name} (@${owner.username})`
                        : `@${owner.username}`;

                    ownerId = owner.id;

                    if (owner.avatar) {
                        ownerAvatar =
                            `https://cdn.discordapp.com/avatars/${owner.id}/${owner.avatar}.png?size=128`;
                    }
                } catch (error) {
                    console.error(
                        `Failed to fetch owner for ${guild.id}:`,
                        error
                    );
                }
            }

            const serverIcon = guild.icon
                ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`
                : null;

            await api.channels.createMessage(message.channel_id, {
                embeds: [
                    {
                        title: guild.name ?? "Unknown Server",
                        description: `**Server ID**\n\`${guild.id}\``,
                        color: 0x5865f2,

                        thumbnail: serverIcon
                            ? {
                                  url: serverIcon,
                              }
                            : undefined,

                        fields: [
                            {
                                name: "👑 Owner",
                                value: ownerUsername,
                                inline: true,
                            },
                            {
                                name: "🆔 Owner ID",
                                value: `\`${ownerId}\``,
                                inline: true,
                            },
                            {
                                name: "🤖 Bot",
                                value: "Questify",
                                inline: true,
                            },
                        ],

                        footer: {
                            text: `Server ${guilds.indexOf(guild) + 1} of ${guilds.length}`,
                        },

                        ...(ownerAvatar
                            ? {
                                  author: {
                                      name: ownerUsername,
                                      icon_url: ownerAvatar,
                                  },
                              }
                            : {}),
                    },
                ],

                message_reference: {
                    message_id: message.id,
                },
            });
        }
    } catch (error) {
        console.error("Servers command error:", error);

        await api.channels.createMessage(message.channel_id, {
            content: "❌ Failed to fetch server information.",
            message_reference: {
                message_id: message.id,
            },
        });
    }
}
