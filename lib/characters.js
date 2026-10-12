import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Array principal en memoria y sincronización global
export const characters = [];
global.characters = characters;

// Normalizador para evitar errores de tildes o mayúsculas en las rarezas
export const normalizeStr = (str) => {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

// Detección dinámica basada en tus 8 Rarezas Exactas
export const getDynamicRarity = (char) => {
    if (!char) return "común";
    
    const v = Number(char.votes) || 0; 

    if (v >= 100000) return "secreto";
    if (v >= 14580) return "mítico";
    if (v >= 4860) return "legendario";
    if (v >= 1620) return "épico";
    if (v >= 540) return "muy raro";
    if (v >= 180) return "raro";
    if (v >= 60) return "poco común";

    const rawRarity = normalizeStr(char.rarity || char.rareza || char.clase || char.tier);
    if (rawRarity.includes('secreto')) return "secreto";
    if (rawRarity.includes('mitico')) return "mítico";
    if (rawRarity.includes('legendario') || rawRarity.includes('leyenda')) return "legendario";
    if (rawRarity.includes('epico') || rawRarity.includes('especial')) return "épico";
    if (rawRarity.includes('muy raro')) return "muy raro";
    if (rawRarity.includes('raro')) return "raro";
    if (rawRarity.includes('poco')) return "poco común";

    return "común";
};

// Tabla de Precios para las 8 Rarezas
export const getPrice = (rarity) => {
    const r = normalizeStr(rarity);

    switch (r) {
        case 'comun':
        case 'común': return 5000;
        case 'poco comun':
        case 'poco común': return 10000; 
        case 'raro': return 30000; 
        case 'muy raro': return 90000; 
        case 'epico':
        case 'épico': return 250000; 
        case 'legendario': return 750000; 
        case 'mitico':
        case 'mítico': return 2000000;
        case 'secreto': return 10000000;
        default: return 5000;
    }
};

// Sistema de carga multi-ruta flexible
export const loadCategories = async () => {
    const tempArray = [];
    const cwd = process.cwd();

    // Rutas donde el bot buscará bases de datos
    const possibleFolders = [
        path.join(__dirname, 'characters'),
        path.join(cwd, 'lib', 'characters')
    ];

    const possibleSingleFiles = [
        path.join(__dirname, 'characters.json'),
        path.join(cwd, 'lib', 'characters.json'),
        path.join(cwd, 'characters.json')
    ];

    let loadedCount = 0;

    // 1. Cargar desde carpetas (archivos .js y .json dentro)
    for (const folder of possibleFolders) {
        if (fs.existsSync(folder)) {
            const files = fs.readdirSync(folder).filter(f => f.endsWith('.js') || f.endsWith('.json'));
            for (const file of files) {
                try {
                    const filePath = path.join(folder, file);
                    if (file.endsWith('.json')) {
                        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                        if (Array.isArray(content)) tempArray.push(...content);
                        else if (content.characters && Array.isArray(content.characters)) tempArray.push(...content.characters);
                    } else {
                        const fileUrl = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
                        const module = await import(fileUrl);
                        const extractedData = module.characters || module.data || module.default || module;
                        if (Array.isArray(extractedData)) {
                            tempArray.push(...extractedData);
                        } else if (typeof extractedData === 'object' && Array.isArray(extractedData.characters)) {
                            tempArray.push(...extractedData.characters);
                        }
                    }
                } catch (e) {
                    console.error(chalk.red(`❌ [Gacha] Error cargando: ${file} -> ${e.message}`));
                }
            }
        }
    }

    // 2. Cargar desde archivos .json sueltos si existen
    for (const singleFile of possibleSingleFiles) {
        if (fs.existsSync(singleFile)) {
            try {
                const content = JSON.parse(fs.readFileSync(singleFile, 'utf-8'));
                const list = Array.isArray(content) ? content : (content.characters || []);
                if (list.length > 0) tempArray.push(...list);
            } catch (e) {
                console.error(chalk.red(`❌ [Gacha] Error leyendo archivo: ${singleFile} -> ${e.message}`));
            }
        }
    }

    // Si no encontró nada, asegura la existencia de la carpeta principal
    if (tempArray.length === 0) {
        const mainFolder = possibleFolders[0];
        if (!fs.existsSync(mainFolder)) {
            fs.mkdirSync(mainFolder, { recursive: true });
        }
        console.log(chalk.yellow(`⚠ [Gacha] No se encontraron personajes. Asegúrate de colocar tus archivos .js o .json dentro de '${mainFolder}' o en 'lib/characters.json'.`));
    }

    // Procesar e inyectar al array principal sin romper referencias
    characters.length = 0; 
    tempArray.forEach((char, index) => {
        if (!char || (!char.name && !char.nombre)) return;
        
        const name = char.name || char.nombre;
        const keyword = char.keyword || char.id || `${normalizeStr(name).replace(/\s+/g, '_')}_${String(index).padStart(2, '0')}`;
        const finalRarity = getDynamicRarity(char);
        const finalPrice = Number(char.price || char.value || char.precio) || getPrice(finalRarity);
        
        characters.push({
            ...char,
            name,
            keyword,
            rarity: finalRarity,
            votes: Number(char.votes) || 0,
            series: char.series || char.anime || char.source || 'Desconocido',
            type: char.type || "anime",
            price: finalPrice
        });
    });

    global.characters = characters;
    console.log(chalk.green(`✅ [Gacha] Base de datos cargada correctamente. Total: ${characters.length} personajes.`));
};

// Obtención con cálculo de probabilidad ajustado a las 8 rarezas
export const getRandomCharacter = () => {
    if (!characters.length) {
        console.error(chalk.red("❌ [Gacha Error] No hay personajes cargados."));
        return null;
    }

    const rarityFactors = {
        "común": 0.5,
        "poco común": 1.0,
        "raro": 3.0,
        "muy raro": 9.0,
        "épico": 18.0,
        "legendario": 54.0,
        "mítico": 162.0,
        "secreto": 1000.0,
    };

    const weightedList = characters.map(char => {
        const r = normalizeStr(char.rarity);
        const factor = rarityFactors[r] || 0.5;
        return { char, weight: 1000 / factor }; 
    });

    const totalWeight = weightedList.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of weightedList) {
        random -= item.weight;
        if (random <= 0) {
            return { ...item.char };
        }
    }
    
    return { ...characters[0] };
};

// Función para buscar información de un personaje por coincidencia de texto
export const searchCharacter = (query) => {
    if (!query || !characters.length) return [];
    const q = normalizeStr(query);
    return characters.filter(c => 
        normalizeStr(c.name).includes(q) || 
        normalizeStr(c.keyword).includes(q) ||
        normalizeStr(c.series).includes(q)
    );
};

// Función para obtener información exacta por ID/Keyword
export const getCharacterById = (id) => {
    if (!id || !characters.length) return null;
    const q = normalizeStr(id);
    return characters.find(c => normalizeStr(c.keyword) === q || normalizeStr(c.id) === q) || null;
};

// Carga inicial
await loadCategories();

// Auto-recarga cuando guardes o modifiques archivos
try {
    const charFolder = path.join(__dirname, 'characters');
    let timeout;
    if (fs.existsSync(charFolder)) {
        fs.watch(charFolder, (eventType, filename) => {
            if (filename && (filename.endsWith('.js') || filename.endsWith('.json'))) {
                clearTimeout(timeout);
                timeout = setTimeout(async () => {
                    await loadCategories();
                }, 1000);
            }
        });
    }
} catch (e) {}
                             
