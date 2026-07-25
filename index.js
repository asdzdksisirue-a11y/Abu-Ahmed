const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// آي دي الروم الصوتي الثابت حقك
const FIXED_VOICE_CHANNEL_ID = '1529174493753508062'; 

// قراءة الملفات تلقائياً
const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.includes('اخذ') || file.includes('جابك') || file.includes('نتغير'));
const choices = (files.length > 0 ? files : ['index.js']).slice(0, 25).map(file => ({ name: file.substring(0, 100), value: file }));

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('تشغيل الملفات المرفوعة في الروم الثابت')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('اختر الملف المطلوب')
                .setRequired(true)
                .addChoices(...choices)
        )
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // أول ما يشتغل البوت، يدخل الروم الثابت تلقائياً
    try {
        const guild = client.guilds.cache.first();
        if (guild) {
            const channel = guild.channels.cache.get(FIXED_VOICE_CHANNEL_ID);
            if (channel) {
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                });
                console.log(`دخل الروم الثابت بنجاح: ${channel.name}`);
            }
        }
    } catch (e) {
        console.log('ما قدر يدخل الروم تلقائياً:', e);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'play') {
        const songName = interaction.options.getString('song');
        const guild = interaction.guild;
        const channel = guild.channels.cache.get(FIXED_VOICE_CHANNEL_ID);

        if (!channel) {
            return interaction.reply({ content: 'ما قدرت ألقى الروم الثابت، تأكد من الآي دي!', ephemeral: true });
        }

        const filePath = path.join(__dirname, songName);

        if (!fs.existsSync(filePath)) {
            return interaction.reply({ content: `ما لقيت الملف: **${songName}**`, ephemeral: true });
        }

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(filePath);

            connection.subscribe(player);
            player.play(resource);

            await interaction.reply(`ابشر يا مجيد، جاري تشغيل: **${songName}** في رومك الثابت 🎵`);

            player.on(AudioPlayerStatus.Idle, () => {
                // البوت يبقى في الروم ولا يخرج منه
            });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'صار خطأ أثناء تشغيل الملف.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
