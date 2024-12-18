// File: index.js

require('dotenv').config();
const { Client, GatewayIntentBits, MessageActionRow, MessageButton } = require('discord.js');
const mysql = require('mysql2');

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Bot setup
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Initialize database
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
            registered BOOLEAN DEFAULT FALSE
        );`,

        `CREATE TABLE IF NOT EXISTS admin_passwords (
            admin_id BIGINT PRIMARY KEY,
            password VARCHAR(255)
        );`,

        `CREATE TABLE IF NOT EXISTS inventory (
            user_id BIGINT PRIMARY KEY,
            beginner_sword BOOLEAN DEFAULT FALSE
        );`
    ];

    queries.forEach((query) => db.query(query));
    console.log("Database initialized.");
}

// Bot events
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    initDb();
});

// Helper functions
function userExists(userId, callback) {
    db.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
        if (err) throw err;
        callback(results.length > 0);
    });
}

function registerUser(userId, username, callback) {
    db.query("INSERT INTO users (id, username, registered) VALUES (?, ?, TRUE)", [userId, username], (err) => {
        if (err) throw err;
        callback(true);
    });
}

// Commands handling
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args.shift().toLowerCase();

    // Register Command
    if (command === '!register') {
        userExists(message.author.id, (exists) => {
            if (exists) {
                message.reply("You are already registered!");
            } else {
                registerUser(message.author.id, message.author.username, () => {
                    message.reply("You have successfully registered! Use `!roll` to roll your breathing.");
                });
            }
        });
    }

    // Roll Command
    if (command === '!roll') {
        db.query("SELECT has_rolled FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;

            if (results.length === 0) {
                message.reply("You need to register first using `!register`.");
                return;
            }

            if (results[0].has_rolled) {
                message.reply("You have already rolled a breathing!");
                return;
            }

            // Breathing Probability
            const breathings = {
                "Water Breathing": 50,
                "Thunder Breathing": 20,
                "Beast Breathing": 15,
                "Mist Breathing": 10,
                "Sun Breathing": 5
            };

            const options = [];
            for (const [key, value] of Object.entries(breathings)) {
                for (let i = 0; i < value; i++) {
                    options.push(key);
                }
            }

            const rolledBreathing = options[Math.floor(Math.random() * options.length)];

            db.query("UPDATE users SET has_rolled = TRUE WHERE id = ?", [message.author.id], (err) => {
                if (err) throw err;
                message.reply(`You rolled **${rolledBreathing}**!`);
            });
        });
    }

    // Character Status
    if (command === '!cstatus') {
        db.query("SELECT * FROM users WHERE id = ?", [message.author.id], (err, results) => {
            if (err) throw err;
            if (results.length === 0) {
                message.reply("You need to register first using `!register`.");
                return;
            }

            const user = results[0];
            message.reply(`
                **Character Status**:
                **Level:** ${user.level}
                **EXP:** ${user.exp}
                **Stamina:** ${user.stamina}
                **Coins:** ${user.coins}
            `);
        });
    }

    // Claim Stamina
    if (command === '!claim') {
        const staminaGain = Math.floor(Math.random() * 50) + 1;
        db.query("UPDATE users SET stamina = stamina + ? WHERE id = ?", [staminaGain, message.author.id], (err) => {
            if (err) throw err;
            message.reply(`You claimed **${staminaGain}** stamina!`);
        });
    }

// !0lp - Give starter items if level 0
if (command === '!0lp') {
  db.query("SELECT * FROM users WHERE id = ? AND level = 0", [message.author.id], (err, results) => {
      if (err) throw err;

      if (results.length === 0) {
          message.reply("You are not level 0 or have already used this command!");
          return;
      }

      // Check if user already has inventory
      db.query("SELECT * FROM inventory WHERE user_id = ?", [message.author.id], (err, invResults) => {
          if (err) throw err;

          if (invResults.length > 0) {
              message.reply("You already have your starter items!");
              return;
          }

          // Give starter items
          db.query("UPDATE users SET coins = coins + 100, stamina = stamina + 100 WHERE id = ?", [message.author.id]);
          db.query("INSERT INTO inventory (user_id, beginner_sword) VALUES (?, TRUE)", [message.author.id]);
          message.reply("You received a beginner sword, 100 coins, and 100 stamina!");
      });
  });
}


    // Store Command
    if (command === '!store') {
        const storeItems = `
        **Demon Slayer Store**:
        1. Sword - 100 Coins
        2. Stamina Potion - 50 Coins
        3. EXP Boost - 200 Coins
        `;
        message.reply(storeItems);
    }

    // Buy Command
    if (command === '!buy') {
        const itemNumber = parseInt(args[0]);
        const quantity = parseInt(args[1]);

        if (!itemNumber || !quantity || quantity <= 0) {
            message.reply("Invalid usage! Use `!buy <item_number> <quantity>`.");
            return;
        }

        const itemPrices = {
            1: 100,  // Sword
            2: 50,   // Stamina Potion
            3: 200   // EXP Boost
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

    // Leaderboard Command
    if (command === '!leaderboard') {
        db.query("SELECT username, level, coins, stamina FROM users ORDER BY level DESC LIMIT 10", (err, results) => {
            if (err) throw err;

            const leaderboard = results.map((user, index) => {
                return `**${index + 1}. ${user.username}** - Level: ${user.level}, Coins: ${user.coins}, Stamina: ${user.stamina}`;
            }).join('\n');

            message.reply(`**Top 10 Players:**\n${leaderboard}`);
        });
    }
});

// Login the bot
client.login(process.env.TOKEN);
