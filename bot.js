const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// Configure seus tokens aqui
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Armazena histórico de conversas por usuário
const conversationHistory = new Map();

client.once('clientReady', () => {
  console.log(`✅ Bot IA online como ${client.user.tag}`);
  
  // Define o status do bot
  client.user.setPresence({
    activities: [{ name: '🌟 Suas Perguntas | Me marque🌟 ', type: 3 }],
    status: 'online'
  });
});

client.on('messageCreate', async (message) => {
  // Ignora mensagens de bots
  if (message.author.bot) return;

  // Verifica se o bot foi mencionado
  if (!message.mentions.has(client.user.id)) return;

  // Remove a menção do bot da mensagem
  const userMessage = message.content.replace(/<@!?\d+>/g, '').trim();

  if (!userMessage) {
    return message.reply('👋 Oi! Me mencione e faça uma pergunta que eu respondo! Exemplo: `@bot qual a capital do Brasil?`');
  }

  // Mostra que está "digitando"
  await message.channel.sendTyping();

  try {
    // Pega ou cria o histórico de conversa do usuário
    const userId = message.author.id;
    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, []);
    }
    const history = conversationHistory.get(userId);

    // Monta as mensagens para a API
    const messages = [
      {
        role: 'system',
        content: 'Você é um assistente amigável e útil no Discord. Responda de forma natural, concisa e amigável. Use emojis ocasionalmente para deixar a conversa mais leve. Seja direto e objetivo nas respostas.'
      }
    ];

    // Adiciona histórico recente (últimas 5 mensagens)
    const recentHistory = history.slice(-5);
    for (const msg of recentHistory) {
      messages.push({ role: 'user', content: msg.user });
      messages.push({ role: 'assistant', content: msg.bot });
    }

    // Adiciona mensagem atual
    messages.push({ role: 'user', content: userMessage });

    // Faz requisição para a API da Groq
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let botResponse = response.data.choices[0].message.content;

    // Limita o tamanho da resposta (Discord tem limite de 2000 caracteres)
    if (botResponse.length > 1900) {
      botResponse = botResponse.substring(0, 1900) + '... *(resposta muito longa, continuação cortada)*';
    }

    // Salva no histórico
    history.push({
      user: userMessage,
      bot: botResponse
    });

    // Limita o histórico a 10 interações
    if (history.length > 10) {
      history.shift();
    }

    // Envia a resposta
    await message.reply(botResponse);

  } catch (error) {
    console.error('Erro ao gerar resposta:', error.response?.data || error.message);
    
    let errorMessage = '❌ Desculpe, ocorreu um erro ao processar sua mensagem.';
    
    if (error.response?.status === 401) {
      errorMessage = '❌ Erro na API key da Groq! Verifique se configurou corretamente.';
    } else if (error.response?.status === 429) {
      errorMessage = '❌ Limite de uso da API atingido! Tente novamente em alguns segundos.';
    }
    
    await message.reply(errorMessage);
  }
});

// Comando para limpar histórico
client.on('messageCreate', async (message) => {
  if (message.content === '!limpar' && message.mentions.has(client.user.id)) {
    conversationHistory.delete(message.author.id);
    await message.reply('🗑️ Histórico de conversa limpo! Vamos começar do zero.');
  }
});

client.login(DISCORD_TOKEN);