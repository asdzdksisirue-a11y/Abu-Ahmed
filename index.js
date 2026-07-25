const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    createAudioPlayer,
} = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const player = createAudioPlayer();

// آيدي الروم الصوتي حقك اللي يثبت فيه البوت
const VOICE_CHANNEL_ID = '1529174493753508062';

// إعداد أمر السلاش
const commands = [
    new SlashCommandBuilder()
        .setName('شغل')
        .setDescription('تشغيل مقطع أو أغنية عبر البوت')
        .addStringOption(option =>
            option.setName('البحث')
                .setDescription('اسم الأغنية أو الرابط')
                .setRequired(true))
].map(command => command.toJSON());

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // تسجيل أوامر السلاش في ديسكورد تلقائياً
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('تم تسجيل أوامر السلاش بنجاح!');
    } catch (error) {
        console.error(error);
    }

    // دخول البوت تلقائياً للروم الصوتي أول ما يشتغل
    try {
        const guild = client.guilds.cache.first();
        if (guild) {
            const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
            if (channel && channel.isVoiceBased()) {
                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                });

                await entersState(connection, VoiceConnectionStatus.Ready, 20 * 1000);
                connection.subscribe(player);
                console.log(`تم دخول البوت إلى الروم الصوتي بنجاح!`);
            }
        }
    } catch (error) {
        console.error('فشل في الاتصال التلقائي بالروم الصوتي:', error);
    }
});

// التفاعل مع أمر السلاش (/)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'شغل') {
        const query = interaction.options.getString('البحث');

        const channel = interaction.member?.voice.channel || interaction.guild?.channels.cache.get(VOICE_CHANNEL_ID);
        if (!channel) {
            return interaction.reply({ content: 'يا ليت تدخل روم صوتي أول!', ephemeral: true });
        }

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 20 * 1000);
            connection.subscribe(player);
            
            await interaction.reply(`ابشر يا مجيد، جاري تشغيل الطلب: **${query}**`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'فشلت محاولة الاتصال بالصوت، تأكد من الأذونات.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
