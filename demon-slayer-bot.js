import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, InteractionType } from 'discord.js';
import mysql from 'mysql';
import { config } from 'dotenv';
config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) throw err;
    console.log('Database initialized.');
});

function initDb() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (
            id BIGINT PRIMARY KEY,
            username VARCHAR(255),
            level INT DEFAULT 0,
            exp INT DEFAULT 0,
            stamina INT DEFAULT 100,
            coins INT DEFAULT 0,
            has_rolled BOOLEAN DEFAULT FALSE,
            registered BOOLEAN DEFAULT FALSE,
            breathing VARCHAR(255),
            is_admin BOOLEAN DEFAULT FALSE
        );`,

        `CREATE TABLE IF NOT EXISTS admin_passwords (
            admin_id BIGINT PRIMARY KEY,
            password VARCHAR(255)
        );`,

        `CREATE TABLE IF NOT EXISTS inventory (
            user_id BIGINT PRIMARY KEY,
            beginner_sword BOOLEAN DEFAULT FALSE,
            potion INT DEFAULT 0,
            exp_boost INT DEFAULT 0,
            armor BOOLEAN DEFAULT FALSE,
            shield BOOLEAN DEFAULT FALSE
        );`
    ];

    queries.forEach((query) => db.query(query));
    console.log("Database initialized.");
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    initDb();
    client.user.setActivity('Demon Slayer', { type: 'PLAYING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args.shift().toLowerCase();

    if (command !== '!register' && command !== '!help') {
        const userRegistered = await new Promise((resolve, reject) => {
            db.query("SELECT registered FROM users WHERE id = ?", [message.author.id], (err, results) => {
                if (err) return reject(err);
                resolve(results.length > 0 && results[0].registered);
            });
        });

        if (!userRegistered) {
            message.reply("You need to register first using `!register`.");
            return;
        }
    }

    if (command === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("Help - List of Commands")
            .setDescription("Use the commands to interact with the bot.")
            .addFields(
                { name: "!register", value: "Register yourself to use the bot." },
                { name: "!roll", value: "Roll to receive your breathing." },
                { name: "!cstatus", value: "Check your character status." },
                { name: "!claim", value: "Claim stamina." },
                { name: "!0lp", value: "Get starter items if you are level 0." },
                { name: "!store", value: "View the store items." },
                { name: "!buy <item_number> <quantity>", value: "Buy items from the store." },
                { name: "!leaderboard", value: "View the top 10 players." },
                { name: "!fight", value: "Fight a demon." },
                { name: "!spawndemon", value: "Spawn a random demon." },
                { name: "!inv", value: "Check your inventory." },
                { name: "!pac <amount of coins>", value: "Buy amino coins in exchange for coins." },
                { name: "!radmin <password>", value: "Register as admin with the correct password." },
                { name: "!pcoins <amount of ac>", value: "Buy coins in exchange for amino coins." },
                { name: "!duser", value: "Delete user data (admin only)." }
            )
            .setFooter({ text: "Demon Slayer Bot", iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
    
        message.reply({ embeds: [helpEmbed] });
    }


    if (command === '!register') {
        db.query("SELECT * FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;
            if (results.length > 0) {
                message.reply("You are already registered!");
                return;
            }

            db.query("INSERT INTO users (id, username, registered) VALUES (?, ?, TRUE)", [message.author.id, message.author.username], (err) => {
                if (err) throw err;
                message.reply("Registration complete! Use `!roll` to receive your breathing.");
            });
        });
    }

    if (command === '!roll') {
        db.query("SELECT has_rolled FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;
            if (!results.length) {
                message.reply("You need to register first using `!register`.");
                return;
            }
    
            if (results[0].has_rolled) {
                message.reply("You already rolled your breathing! Breathing is permanent.");
                return;
            }
    
            const breathings = {
                "Water Breathing": { chance: 15, emoji: "💧" },
                "Thunder Breathing": { chance: 10, emoji: "⚡" },
                "Beast Breathing": { chance: 8, emoji: "🐗" },
                "Mist Breathing": { chance: 7, emoji: "🌫️" },
                "Flame Breathing": { chance: 6, emoji: "🔥" },
                "Wind Breathing": { chance: 9, emoji: "💨" },
                "Stone Breathing": { chance: 4, emoji: "🪨" },
                "Sound Breathing": { chance: 5, emoji: "🎶" },
                "Love Breathing": { chance: 3, emoji: "💖" },
                "Serpent Breathing": { chance: 2, emoji: "🐍" },
                "Moon Breathing": { chance: 1, emoji: "🌙" },
                "Sun Breathing": { chance: 0.5, emoji: "☀️" }
            };
    
            const options = [];
            for (const [key, { chance }] of Object.entries(breathings)) {
                for (let i = 0; i < chance * 10; i++) {
                    options.push(key);
                }
            }
    
            const rollingMessage = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle("Rolling...")
                .setDescription(`🎲 Rolling for your breathing style... Please wait!`)
                .setFooter({ text: "Good luck!" })
                .setTimestamp();
    
            message.channel.send({ embeds: [rollingMessage] }).then(sentMessage => {
                setTimeout(() => {
                    const rolledBreathing = options[Math.floor(Math.random() * options.length)];
                    console.log(`Rolled Breathing: ${rolledBreathing}`);
    
                    db.query("UPDATE users SET has_rolled = TRUE, breathing = ? WHERE id = ?", [rolledBreathing, message.author.id], (err) => {
                        if (err) throw err;
    
                        const resultEmbed = new EmbedBuilder()
                            .setColor(0x00AE86)
                            .setTitle("Breathing Roll Result")
                            .setDescription(`🎲 You rolled **${breathings[rolledBreathing].emoji} ${rolledBreathing}**!` +
                                `\n${breathings[rolledBreathing].emoji} Embrace your power and conquer your destiny!`)
                            .setFooter({ text: "Breathing is permanent. Use it wisely!" })
                            .setTimestamp();
                        sentMessage.edit({ embeds: [resultEmbed] });
                    });
                }, 3000); // 3-second animation delay
            });
        });
    }
    

    if (command === '!cstatus') {
        db.query("SELECT * FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;
            if (!results.length) {
                message.reply("You need to register first using `!register`.");
                return;
            }

            const user = results[0];
            const statusEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle("Character Status")
                .setThumbnail(message.author.displayAvatarURL())
                .addFields(
                    { name: "Username", value: user.username, inline: true },
                    { name: "Level", value: `${user.level}`, inline: true },
                    { name: "EXP", value: `${user.exp}`, inline: true },
                    { name: "Stamina", value: `${user.stamina}`, inline: true },
                    { name: "Coins", value: `${user.coins}`, inline: true },
                    { name: "Breathing", value: user.breathing || "None", inline: true }
                )
                .setFooter({ text: "Keep training to become the strongest Demon Slayer!" });

            message.reply({ embeds: [statusEmbed] });
        });
    }

    if (command === '!claim') {
        const now = Date.now();
    
        db.query("SELECT last_claim FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;
            const lastClaim = results[0]?.last_claim || 0;
    
            if (now - lastClaim < 10 * 60 * 1000) {
                const timeLeft = Math.ceil((10 * 60 * 1000 - (now - lastClaim)) / 60000);
                message.reply(`You can claim again in **${timeLeft}** minutes.`);
                return;
            }
    
            const staminaGain = Math.floor(Math.random() * 50) + 1;
            db.query(
                "UPDATE users SET stamina = stamina + ?, last_claim = ? WHERE id = ?",
                [staminaGain, now, message.author.id],
                (err) => {
                    if (err) throw err;
                    message.reply(`You claimed **${staminaGain}** stamina!`);
                }
            );
        });
    }
    

    if (command === '!0lp') {
        db.query("SELECT * FROM users WHERE id = ? AND level = 0", [message.author.id], (err, results) => {
            if (err) throw err;

            if (results.length === 0) {
                message.reply("You are not level 0 or have already used this command!");
                return;
            }

            db.query("SELECT * FROM inventory WHERE user_id = ?", [message.author.id], (err, invResults) => {
                if (err) throw err;

                if (invResults.length > 0) {
                    message.reply("You already have your starter items!");
                    return;
                }

                db.query("UPDATE users SET coins = coins + 100, stamina = stamina + 100 WHERE id = ?", [message.author.id]);
                db.query("INSERT INTO inventory (user_id, beginner_sword) VALUES (?, TRUE)", [message.author.id]);
                message.reply("You received a beginner sword, 100 coins, and 100 stamina!");
            });
        });
    }

    if (command === '!spawndemon') {
        const now = Date.now();
    
        db.query("SELECT last_spawn FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;
            const lastSpawn = results[0]?.last_spawn || 0;
    
            if (now - lastSpawn < 15 * 1000) {
                const timeLeft = ((15 * 1000 - (now - lastSpawn)) / 1000).toFixed(1);
                message.reply(`You can spawn a demon again in **${timeLeft}** seconds.`);
                return;
            }
    
            const demons = [
                { name: "Rui (Lower Moon Five)", rank: 1, exp: 50, staminaGain: 20 },
                { name: "Enmu (Lower Moon One)", rank: 2, exp: 60, staminaGain: 25 },
                { name: "Daki & Gyutaro (Upper Moon Six)", rank: 3, exp: 80, staminaGain: 30 },
                { name: "Gyokko (Upper Moon Five)", rank: 4, exp: 90, staminaGain: 35 },
                { name: "Hantengu (Upper Moon Four)", rank: 5, exp: 100, staminaGain: 40 },
                { name: "Akaza (Upper Moon Three)", rank: 6, exp: 120, staminaGain: 50 },
                { name: "Doma (Upper Moon Two)", rank: 7, exp: 140, staminaGain: 60 },
                { name: "Kokushibo (Upper Moon One)", rank: 8, exp: 160, staminaGain: 70 },
                { name: "Rogue Demon", rank: 9, exp: 30, staminaGain: 10 },
                { name: "Muzan Kibutsuji (Demon King)", rank: 10, exp: 200, staminaGain: 100 }
            ];
    
            const demon = demons[Math.floor(Math.random() * demons.length)];
    
            const fightButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fight_demon')
                    .setLabel('Fight!')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚔️')
            );
    
            message.channel.send({
                content: `A wild **${demon.name}** (Rank ${demon.rank}) has appeared! First to press "Fight!" will engage!`,
                components: [fightButton]
            });
    
            db.query("UPDATE users SET last_spawn = ? WHERE id = ?", [now, message.author.id], (err) => {
                if (err) throw err;
            });
    
            let fightInProgress = false;
    
            client.on('interactionCreate', async interaction => {
                if (!interaction.isButton() || interaction.customId !== 'fight_demon') return;
    
                if (fightInProgress) {
                    interaction.reply({ content: "A fight is already in progress!", ephemeral: true });
                    return;
                }
    
                fightInProgress = true;
                await interaction.deferReply();
    
                db.query("SELECT stamina, exp, level FROM users WHERE id = ?", [interaction.user.id], (err, results) => {
                    if (err) throw err;
                    const user = results[0];
    
                    if (user.stamina < staminaCost) {
                        interaction.editReply({ content: "Not enough stamina to fight!", components: [] });
                        fightInProgress = false;
                        return;
                    }
    
                    const newExp = user.exp + demon.exp;
                    const newStamina = user.stamina - staminaCost + demon.staminaGain;
                    let newLevel = user.level;
    
                    if (newExp >= newLevel * 100) {
                        newLevel++;
                    }
    
                    db.query(
                        "UPDATE users SET exp = ?, stamina = ?, level = ? WHERE id = ?", 
                        [newExp, newStamina, newLevel, interaction.user.id], 
                        (err) => {
                            if (err) throw err;
                            interaction.editReply({ content: `You defeated **${demon.name}**! You gained **${demon.exp} EXP** and **${demon.staminaGain} Stamina**! Your current level: **${newLevel}**, Stamina: **${newStamina}**.`, components: [] });
                            fightInProgress = false;
                        }
                    );
                });
            });
        });
    }
    

    if (command === '!store') {
        const storeEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("Demon Slayer Store")
            .addFields(
                { name: "1. Sword", value: "100 Coins", inline: true },
                { name: "2. Potion", value: "50 Coins", inline: true },
                { name: "3. EXP Boost", value: "200 Coins", inline: true },
                { name: "4. Armor", value: "300 Coins", inline: true },
                { name: "5. Shield", value: "150 Coins", inline: true }
            )
            .setFooter({ text: "Use !buy <item_number> <quantity>" });

        message.reply({ embeds: [storeEmbed] });
    }

    if (command === '!buy') {
        const itemNumber = parseInt(args[0]);
        const quantity = parseInt(args[1]);

        if (!itemNumber || !quantity || quantity <= 0) {
            message.reply("Invalid usage! Use `!buy <item_number> <quantity>`.");
            return;
        }

        const itemPrices = {
            1: 100,  // Sword
            2: 50,   // Potion
            3: 200,  // EXP Boost
            4: 300,  // Armor
            5: 150   // Shield
        };

        const itemCost = itemPrices[itemNumber] * quantity;
        if (!itemCost) {
            message.reply("Invalid item number!");
            return;
        }

        db.query("SELECT coins FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;

            const coins = results[0]?.coins ?? 0;
            if (coins < itemCost) {
                message.reply("You don't have enough coins!");
                return;
            }

            db.query("UPDATE users SET coins = coins - ? WHERE id = ?", [itemCost, message.author.id], (err) => {
                if (err) throw err;
                message.reply(`You bought ${quantity} of item ${itemNumber}.`);
            });
        });
    }

    if (command === '!leaderboard') {
        db.query("SELECT username, level, coins, stamina FROM users ORDER BY level DESC LIMIT 10", (err, results) => {
            if (err) throw err;

            const leaderboard = results.map((user, index) => {
                return `**${index + 1}. ${user.username}** - Level: ${user.level}, Coins: ${user.coins}, Stamina: ${user.stamina}`;
            }).join('\n');

            message.reply(`**Top 10 Players:**\n${leaderboard}`);
        });
    }

if (command === '!inv') {
    db.query("SELECT * FROM inventory WHERE user_id = ?", [message.author.id], (err, results) => {
        if (err) throw err;
        if (!results.length) {
            message.reply("You have no items in your inventory.");
            return;
        }

        const inventory = results[0];
        const invEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Inventory")
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: "Beginner Sword", value: inventory.beginner_sword ? "Yes" : "No", inline: true },
                { name: "Potion", value: `${inventory.potion}`, inline: true },
                { name: "EXP Boost", value: `${inventory.exp_boost}`, inline: true },
                { name: "Armor", value: inventory.armor ? "Yes" : "No", inline: true },
                { name: "Shield", value: inventory.shield ? "Yes" : "No", inline: true }
            )
            .setFooter({ text: "Demon Slayer Bot", iconURL: client.user.displayAvatarURL() });

        message.reply({ embeds: [invEmbed] });
    });
}

    if (command === '!pac') {
        const amount = parseInt(args[0]);
        if (!amount || amount <= 0 || amount > 500) {
            message.reply("Invalid amount! Use `!pac <amount>` (1-500).");
            return;
        }

        db.query("SELECT coins FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;

            const coins = results[0]?.coins ?? 0;
            if (coins < amount * 2) {
                message.reply("You don't have enough coins!");
                return;
            }

            const confirmButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_pac')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_pac')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

            message.reply({
                content: `Are you sure you want to buy ${amount} amino coins for ${amount * 2} coins?`,
                components: [confirmButton]
            });

            const filter = i => i.user.id === message.author.id;
            const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'confirm_pac') {
                    db.query("UPDATE users SET coins = coins - ? WHERE id = ?", [amount * 2, message.author.id], (err) => {
                        if (err) throw err;
                        i.update({ content: `Purchase confirmed! You bought ${amount} amino coins.`, components: [] });
                    });
                } else if (i.customId === 'cancel_pac') {
                    i.update({ content: 'Purchase canceled.', components: [] });
                }
            });
        });
    }

    if (command === '!radmin') {
        const password = args[0];
        if (!password) {
            message.reply("You need to provide a password! Use `!radmin <password>`.");
            return;
        }

        db.query("SELECT * FROM admin_passwords WHERE password = ?", [password], (err, results) => {
            if (err) throw err;
            if (!results.length) {
                message.reply("Invalid password!");
                return;
            }

            db.query("UPDATE users SET is_admin = TRUE WHERE id = ?", [message.author.id], (err) => {
                if (err) throw err;
                message.reply("You are now registered as an admin!");
            });
        });
    }

 // pcoins

 if (command === '!pcoins') {
    const amount = parseInt(args[0]);
    if (!amount || amount <= 0) {
        message.reply("Invalid amount! Use `!pcoins <amount>`.");
        return;
    }

    const proofEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Proof Required")
        .setDescription("Please reply to this message with a proof image of your amino coin purchase.")
        .setImage('attachment://proof.jpg'); // Reference the image as an attachment

    message.reply({ embeds: [proofEmbed], files: ['./proof.jpg'] }).then(sentMessage => {
        const filter = m => m.author.id === message.author.id && m.attachments.size > 0;
        const collector = message.channel.createMessageCollector({ filter, time: 60000 });

        collector.on('collect', m => {
            const confirmButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_pcoins')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_pcoins')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

            sentMessage.reply({
                content: `Proof received. Admins, please confirm or cancel the purchase.`,
                components: [confirmButton]
            });

            const adminFilter = i => i.customId === 'confirm_pcoins' || i.customId === 'cancel_pcoins';
            const adminCollector = sentMessage.channel.createMessageComponentCollector({ adminFilter, time: 60000 });

            adminCollector.on('collect', async i => {
                if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    i.reply({ content: 'Only admins can confirm this purchase.', ephemeral: true });
                    return;
                }

                if (i.customId === 'confirm_pcoins') {
                    db.query("UPDATE users SET coins = coins + ? WHERE id = ?", [amount, message.author.id], (err) => {
                        if (err) throw err;
                        i.update({ content: `Purchase confirmed! You received ${amount} coins.`, components: [] });
                    });
                } else if (i.customId === 'cancel_pcoins') {
                    i.update({ content: 'Purchase canceled.', components: [] });
                }
            });
        });
    });
}


    if (command === '!duser') {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            message.reply("You don't have permission to use this command.");
            return;
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            message.reply("You need to mention a user to delete their data.");
            return;
        }

        db.query("DELETE FROM users WHERE id = ?", [targetUser.id], (err) => {
            if (err) throw err;
            message.reply(`User data for ${targetUser.username} has been deleted.`);
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'fight_demon') {
        if (interaction.replied || interaction.deferred) return;
        await interaction.deferReply();

        db.query("SELECT * FROM users WHERE id = ?", [interaction.user.id], async (err, results) => {
            if (err) throw err;
            const user = results[0];

            const demons = {
                "Lower Moon": { hp: 50 + user.level * 5, attack: 5 + user.level },
                "Upper Moon": { hp: 100 + user.level * 10, attack: 10 + user.level * 2 },
                "Rogue Demon": { hp: 75 + user.level * 7, attack: 7 + user.level * 1.5 },
                "Muzan Kibutsuji": { hp: 200 + user.level * 20, attack: 20 + user.level * 3 }
            };

            const demon = demons[interaction.message.content.match(/\*\*(.*?)\*\*/)[1]];
            let userHp = 100 + user.level * 10;
            let demonHp = demon.hp;

            const fightEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("Fight with Demon")
                .setDescription(`You are fighting a ${interaction.message.content.match(/\*\*(.*?)\*\*/)[1]}!`)
                .addFields(
                    { name: "Your HP", value: `${userHp}`, inline: true },
                    { name: "Demon's HP", value: `${demonHp}`, inline: true }
                );

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('attack1')
                        .setLabel('Attack 1')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('attack2')
                        .setLabel('Attack 2')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('attack3')
                        .setLabel('Attack 3')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('attack4')
                        .setLabel('Attack 4')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.editReply({ embeds: [fightEmbed], components: [row] });

            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId.startsWith('attack')) {
                    const userAttack = Math.floor(Math.random() * 20) + 1 + user.level;
                    demonHp -= userAttack;

                    if (demonHp <= 0) {
                        collector.stop('demonDefeated');
                        return;
                    }

                    const demonAttack = Math.floor(Math.random() * demon.attack) + 1;
                    userHp -= demonAttack;

                    if (userHp <= 0) {
                        collector.stop('userDefeated');
                        return;
                    }

                    const updatedEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle("Fight with Demon")
                        .setDescription(`You are fighting a ${interaction.message.content.match(/\*\*(.*?)\*\*/)[1]}!`)
                        .addFields(
                            { name: "Your HP", value: `${userHp}`, inline: true },
                            { name: "Demon's HP", value: `${demonHp}`, inline: true }
                        );

                    await i.update({ embeds: [updatedEmbed], components: [row] });
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'demonDefeated') {
                    const expGain = { "Lower Moon": 10, "Upper Moon": 20, "Rogue Demon": 15, "Muzan Kibutsuji": 50 }[interaction.message.content.match(/\*\*(.*?)\*\*/)[1]];
                    const itemGain = { "Lower Moon": 'Potion', "Upper Moon": 'Sword', "Rogue Demon": 'Shield', "Muzan Kibutsuji": 'Rare Item' }[interaction.message.content.match(/\*\*(.*?)\*\*/)[1]];

                    db.query("UPDATE users SET exp = exp + ? WHERE id = ?", [expGain, interaction.user.id], (err) => {
                        if (err) throw err;
                    });

                    const victoryEmbed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setTitle("Victory!")
                        .setDescription(`You defeated the ${interaction.message.content.match(/\*\*(.*?)\*\*/)[1]}!`)
                        .addFields(
                            { name: "EXP Gained", value: `${expGain}`, inline: true },
                            { name: "Item Gained", value: `${itemGain}`, inline: true }
                        );

                    await interaction.followUp({ embeds: [victoryEmbed] });
                } else if (reason === 'userDefeated') {
                    const defeatEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle("Defeat")
                        .setDescription(`You were defeated by the ${interaction.message.content.match(/\*\*(.*?)\*\*/)[1]}.`);

                    await interaction.followUp({ embeds: [defeatEmbed] });
                }
            });
        });
    }
});

client.login(process.env.TOKEN);