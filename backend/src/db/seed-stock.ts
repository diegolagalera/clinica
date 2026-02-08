import { db } from './index.js';
import { clinics, suppliers, inventoryItems, stockPacks, stockPackItems } from './schema.js';
import { eq } from 'drizzle-orm';

// Stock data organized by category
const stockData = {
    '1. Exploración y diagnóstico': [
        'Espejo dental',
        'Sonda/explorador periodontal',
        'Sonda periodontal (para medir bolsas periodontales)',
        'Luz intraoral',
        'Pinzas exploradoras',
        'Cámara intraoral',
        'Radiografía dental / sensor de imagen',
    ],
    '2. Limpieza dental (higiene)': [
        'Curetas supragingivales',
        'Curetas subgingivales',
        'Ultrasonido (cavitron) / Scaler ultrasónico',
        'Escalpelo periodontal',
        'Piedra pómez / goma prophylaxis',
        'Cepillo y pasta profiláctica',
        'Hilo dental profesional',
    ],
    '3. Tratamientos restaurativos': [
        'Turbina dental / pieza de mano de alta velocidad',
        'Contra-ángulo / baja velocidad',
        'Fresas dentales (diferentes formas y tamaños)',
        'Cucharillas de dentina',
        'Espátulas mezcladoras',
        'Porta‐amalgama / porta‐composite',
        'Lámpara de fotocurado',
        'Matrices dentales y anillos (sistema matricial)',
    ],
    '4. Anestesia': [
        'Jeringa carpule',
        'Agujas de anestesia',
        'Cartuchos de anestesia',
        'Vasoconstrictor si aplica (contenido en cartucho)',
    ],
    '5. Cirugía oral menor': [
        'Elevadores',
        'Fórceps de extracción',
        'Periostótomo',
        'Curetas quirúrgicas',
        'Tijeras quirúrgicas',
        'Pinzas anatómicas',
        'Suturas y portaagujas',
        'Cuchillas/ bisturí',
        'Apósito hemostático',
    ],
    '6. Endodoncia (tratamiento de conductos)': [
        'Localizador apical electrónico',
        'Limas manuales y rotatorias',
        'Porta‐limas',
        'Conos de gutapercha',
        'Irrigadores',
        'Sistemas de obturación (termoplásticos, condensadores, etc.)',
        'Alemanes/espaciadores',
    ],
    '7. Prótesis y odontología protésica': [
        'Impresión dental',
        'Cubetas de impresión',
        'Materiales alginato / silicona',
        'Modelos de yeso',
        'Articulador',
        'Herramientas de ajuste de prótesis',
        'Fresas para prótesis',
        'Ceras de diagnóstico',
    ],
    '8. Control de aislamiento': [
        'Dique de goma / lámina de hule',
        'Abrazaderas',
        'Porta dique',
        'Bombilla de succión saliva / aspiradores',
    ],
    '9. Succión y control de fluidos': [
        'Aspirador salival (HVE)',
        'Jeringa triple (aire/agua)',
        'Cánulas de succión',
    ],
    '10. Materiales y consumibles': [
        'Selladores',
        'Cemento dental',
        'Bases y liners',
        'Flúor',
        'Selladores de fosas y fisuras',
        'Agentes de grabado / adhesivos',
        'Anestésicos',
        'Guantes, mascarillas, barreras desechables',
    ],
    '11. Esterilización y desinfección': [
        'Autoclave',
        'Ultrasonido limpiador',
        'Esterilizadores químicos',
        'Bandejas y contenedores de esterilización',
        'Indicadores de esterilización',
        'Desinfectantes de superficies',
    ],
    '12. Accesorios complementarios': [
        'Retractores labiales / bucales',
        'Espejos de tres vías',
        'Separadores de mejillas',
        'Reglas de medida dental',
        'Portaminas de anotación clínica',
        'Kits de impresión digital (escáner 3D)',
    ],
};

// Random locations for items
const locations = [
    'Armario 1 - Estante A',
    'Armario 1 - Estante B',
    'Armario 2 - Estante A',
    'Armario 2 - Estante B',
    'Cajón 1',
    'Cajón 2',
    'Cajón 3',
    'Vitrina central',
    'Zona esterilización',
    'Almacén auxiliar',
];

function getRandomLocation(): string {
    return locations[Math.floor(Math.random() * locations.length)]!;
}

function generateSKU(category: string, index: number): string {
    const catNum = category.split('.')[0];
    return `INV-${catNum?.padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`;
}

function generateSupplierCode(supplierPrefix: string, index: number): string {
    return `${supplierPrefix}-${String(index + 1).padStart(4, '0')}`;
}

async function seedStock() {
    console.log('🦷 Starting stock seed...\n');

    try {
        // Get the first clinic (created by main seed)
        const [clinic] = await db
            .select()
            .from(clinics)
            .limit(1);

        if (!clinic) {
            console.error('❌ No clinic found. Run the main seed first: npm run db:seed');
            process.exit(1);
        }

        console.log(`📍 Using clinic: ${clinic.name} (${clinic.id})\n`);

        // Create two suppliers
        console.log('Creating suppliers...');

        const [supplierA] = await db.insert(suppliers).values({
            clinicId: clinic.id,
            name: 'Dental Supply Pro',
            contactPerson: 'Carlos Mendoza',
            email: 'ventas@dentalsupply.com',
            phone: '+34 911 222 333',
            phone2: '+34 600 111 222',
            website: 'https://dentalsupply.com',
            address: 'Polígono Industrial Norte, Nave 15, Madrid',
            notes: 'Proveedor principal de instrumental y material de exploración',
            isActive: true,
        }).returning();
        console.log(`✅ Supplier 1: ${supplierA!.name}`);

        const [supplierB] = await db.insert(suppliers).values({
            clinicId: clinic.id,
            name: 'MedDent Solutions',
            contactPerson: 'Ana García',
            email: 'pedidos@meddent.es',
            phone: '+34 922 333 444',
            phone2: '+34 700 222 333',
            website: 'https://meddent.es',
            address: 'Avenida de la Industria 42, Barcelona',
            notes: 'Especialista en prótesis, materiales y esterilización',
            isActive: true,
        }).returning();
        console.log(`✅ Supplier 2: ${supplierB!.name}`);

        // Get category list
        const categories = Object.keys(stockData);
        const categoriesSupplierA = categories.slice(0, 6);  // 1-6
        const categoriesSupplierB = categories.slice(6);      // 7-12

        // Track created items for packs
        const itemsByCategory: Record<string, string[]> = {};
        let totalItems = 0;

        // Create inventory items
        console.log('\nCreating inventory items...');

        for (const [category, items] of Object.entries(stockData)) {
            const categoryShortName = category.split('. ')[1] || category;
            const isSupplierA = categoriesSupplierA.includes(category);
            const supplier = isSupplierA ? supplierA! : supplierB!;
            const supplierPrefix = isSupplierA ? 'DSP' : 'MDS';

            itemsByCategory[category] = [];

            for (let i = 0; i < items.length; i++) {
                const itemName = items[i]!;

                const [item] = await db.insert(inventoryItems).values({
                    clinicId: clinic.id,
                    supplierId: supplier.id,
                    sku: generateSKU(category, i),
                    name: itemName,
                    description: `${itemName} - Material clínico de ${categoryShortName.toLowerCase()}`,
                    category: categoryShortName,
                    unit: 'unidades',
                    currentStock: 100,
                    minStock: 20,
                    maxStock: 200,
                    costPrice: '1.00',
                    sellPrice: '0.00',
                    supplierCode: generateSupplierCode(supplierPrefix, totalItems),
                    location: getRandomLocation(),
                    isActive: true,
                }).returning();

                itemsByCategory[category]!.push(item!.id);
                totalItems++;
            }

            console.log(`  📦 ${categoryShortName}: ${items.length} items`);
        }

        console.log(`\n✅ Total items created: ${totalItems}`);

        // Create packs (one per category)
        console.log('\nCreating packs...');

        for (const [category, itemIds] of Object.entries(itemsByCategory)) {
            const categoryShortName = category.split('. ')[1] || category;

            const [pack] = await db.insert(stockPacks).values({
                clinicId: clinic.id,
                name: `Pack ${categoryShortName}`,
                description: `Pack completo de ${categoryShortName.toLowerCase()} con todos los materiales necesarios`,
                category: categoryShortName,
                isActive: true,
            }).returning();

            // Add items to pack
            for (const itemId of itemIds) {
                await db.insert(stockPackItems).values({
                    packId: pack!.id,
                    itemId: itemId,
                    quantity: 1,
                });
            }

            console.log(`  📋 ${pack!.name}: ${itemIds.length} items`);
        }

        console.log('\n========================================');
        console.log('🎉 Stock seeded successfully!');
        console.log('========================================\n');
        console.log('📊 Summary:');
        console.log('----------------------------------------');
        console.log(`  Suppliers: 2`);
        console.log(`  Categories: ${categories.length}`);
        console.log(`  Items: ${totalItems}`);
        console.log(`  Packs: ${categories.length}`);
        console.log('----------------------------------------');
        console.log('\n🏷️ Suppliers:');
        console.log(`  Categories 1-6 → ${supplierA!.name}`);
        console.log(`  Categories 7-12 → ${supplierB!.name}`);
        console.log('----------------------------------------');
        console.log('\n📦 Item Configuration:');
        console.log('  Price (buy): 1.00€');
        console.log('  Price (sell): 0.00€');
        console.log('  Stock: 100 units');
        console.log('  Min Stock: 20 units');
        console.log('  Max Stock: 200 units');
        console.log('----------------------------------------\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Stock seed failed:', error);
        process.exit(1);
    }
}

seedStock();
