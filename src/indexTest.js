  
//PRUEBA CONEXIÓN CON OPENAI PARA GENERAR TEXTO//
const axios = require('axios');
    
//Para configurar las variables de entorno
require('dotenv').config();

async function conectarConOpenAI(mensaje) {
    //Prueba de API
    const productos = axios.get("https://fakestoreapi.com/products");
    
    try {
        const { data } = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            "model": "gpt-4.1",
            "messages": [
            {
                "role": "user",
                "content": "Eres un vendedor de una tienda, y debes detallar qué productos tienes disponible (menciona todos los detalles): "+JSON.stringify(productos.data)
            }
            ]
        },
        {
            headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
            }
        }
        );

        console.log(data.choices[0].message.content);
    } catch (error) {
        console.error("Error al conectarse con OpenAI:", error.response?.data || error.message);
    }
}

    conectarConOpenAI("");
