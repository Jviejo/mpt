# Merkle Patricia Trie Implementation

## Descripción

Este proyecto implementa un **Merkle Patricia Trie** (MPT), una estructura de datos fundamental utilizada en Ethereum para almacenar y verificar datos de manera eficiente y segura. El MPT combina las características de un árbol Patricia (para compresión de prefijos) con hashes criptográficos (para verificación de integridad).

## Características Principales

- **Compresión de Prefijos**: Reduce el almacenamiento al compartir prefijos comunes entre claves
- **Verificación Criptográfica**: Cada nodo tiene un hash único que permite verificar la integridad
- **Eficiencia**: Operaciones de inserción y búsqueda en tiempo O(k) donde k es la longitud de la clave
- **Tipos de Nodos**: Soporta nodos Branch, Extension y Leaf según el estándar de Ethereum

## Estructura del Proyecto

```
eth-merkle-patricia-tree/
├── index.ts          # Implementación principal del MPT
└── README.md         # Este archivo
```

## Tipos de Nodos

### 1. Branch Node
- **Propósito**: Nodo interno que puede tener hasta 16 hijos (0-15 en hexadecimal)
- **Estructura**: Array de 17 elementos (16 hashes de hijos + 1 para valor opcional)
- **Hijos**: Array de hashes de 256 bits que apuntan a Extension Nodes, Leaf Nodes, o Branch Nodes anidados
- **Valor**: Puede almacenar un valor directamente cuando la clave termina exactamente en ese punto del trie
- **Uso**: Cuando múltiples claves comparten un prefijo común y necesitan ser organizadas por el siguiente nibble

### 2. Extension Node
- **Propósito**: Comparte un prefijo común entre múltiples claves
- **Estructura**: Contiene el prefijo compartido y un hash de 256 bits (32 bytes) que referencia al siguiente nodo
- **Hijos**: El hash apunta al siguiente nodo (Branch, Extension o Leaf) que debe ser recuperado de la base de datos
- **Uso**: Para optimizar el almacenamiento de claves con prefijos largos

### 3. Leaf Node
- **Propósito**: Almacena el valor final de una clave
- **Estructura**: Contiene el final de la clave y el valor asociado
- **Hijos**: No tiene hijos (nodo terminal)
- **Uso**: Para representar claves completas y sus valores

## Jerarquía de Nodos

La estructura del MPT sigue una jerarquía específica:

- **Extension Node** → puede apuntar a: Branch Node, Extension Node, o Leaf Node
- **Branch Node** → puede contener: Extension Nodes, Leaf Nodes, o Branch Nodes anidados
- **Leaf Node** → nodo terminal, no tiene hijos

Esta jerarquía permite crear estructuras complejas donde:
- Los Extension Nodes comparten prefijos comunes
- Los Branch Nodes organizan las claves por el siguiente nibble
- Los Leaf Nodes almacenan los valores finales

## Hashes y Referencias en el MPT

En un Merkle Patricia Trie real, los nodos no se referencian directamente entre sí, sino a través de hashes criptográficos de 256 bits (32 bytes). Esto es fundamental para la verificación de integridad y la descentralización.

### Cómo Funcionan los Hashes:

1. **Extension Nodes**: El `nextNode` es un hash de 256 bits que apunta al siguiente nodo
2. **Branch Nodes**: Los `children` son hashes de 256 bits que apuntan a nodos hijos
3. **Leaf Nodes**: No tienen referencias a otros nodos (son terminales)

### Ventajas de Usar Hashes:

- **Verificación de Integridad**: Cualquier cambio en un nodo cambia su hash
- **Descentralización**: Los nodos pueden estar distribuidos en diferentes ubicaciones
- **Pruebas de Merkle**: Permite verificar la existencia de datos sin descargar todo el trie
- **Inmutabilidad**: Cada estado del trie tiene un hash único
- **Propagación de Cambios**: Las modificaciones se propagan hacia arriba, cambiando todos los hashes de los nodos padres

### Implementación en Ethereum:

En Ethereum, estos hashes se almacenan en la base de datos de estado y se utilizan para:
- Verificar transacciones
- Sincronizar nodos
- Probar la existencia de datos
- Mantener la integridad del estado global

### Nota sobre Nuestra Implementación:

Esta implementación es una versión simplificada para propósitos educativos. En lugar de usar hashes de 256 bits, utilizamos referencias directas a nodos en memoria. En una implementación real de producción, todos los `nextNode` y `children` serían hashes que apuntan a nodos almacenados en una base de datos persistente.

## Propagación de Cambios en el MPT

Cuando se modifica un valor en el trie (por ejemplo, el balance de una dirección), se produce una cascada de cambios de hash que se propaga hacia arriba hasta el nodo raíz.

### Ejemplo: Cambio de Balance

```
Estado Inicial:
Address: 0xa71355 → Balance: 45.0ETH
Hash del Leaf Node: 0x1234...
Hash del Branch Node: 0x5678...
Hash del Extension Node: 0x9abc...
Hash Raíz: 0xdef0...

Después de cambiar el balance:
Address: 0xa71355 → Balance: 50.0ETH
Hash del Leaf Node: 0x2345... (cambió)
Hash del Branch Node: 0x6789... (cambió)
Hash del Extension Node: 0xabcd... (cambió)
Hash Raíz: 0xef01... (cambió)
```

### Cómo Funciona la Propagación:

1. **Nodo Modificado**: El Leaf Node que contiene el balance cambia, generando un nuevo hash
2. **Nodos Padres**: Todos los nodos padres (Branch, Extension) recalculan sus hashes
3. **Hash Raíz**: El hash raíz del trie cambia completamente
4. **Verificación**: Cualquier cambio en el estado es detectable comparando hashes raíz

### Implicaciones en Ethereum:

- **Estado Inmutable**: Cada bloque tiene un hash raíz único que representa todo el estado
- **Sincronización**: Los nodos pueden verificar que están sincronizados comparando hashes raíz
- **Pruebas de Inclusión**: Se puede probar que un balance específico existe en un estado particular
- **Rollbacks**: Es posible revertir a estados anteriores usando hashes raíz previos
- **StateRoot por Bloque**: Cada bloque contiene el hash raíz del estado global en ese momento específico

## StateRoot en Ethereum

En Ethereum, cada bloque contiene un campo llamado `stateRoot` que es el hash raíz del Merkle Patricia Trie del estado global en ese momento específico. Esto permite consultar el estado histórico de cualquier cuenta.

### Cómo Funciona:

```
Bloque #1000:
- stateRoot: 0xabc123... (hash del estado global en el bloque 1000)
- timestamp: 1640995200
- transactions: [...]

Bloque #1001:
- stateRoot: 0xdef456... (hash del estado global en el bloque 1001)
- timestamp: 1640995260
- transactions: [...]
```

### Consultas Históricas:

Con el `stateRoot` de un bloque específico, puedes:

1. **Balance Histórico**: Consultar cuánto ETH tenía una dirección en el bloque 1000
2. **Estado de Contratos**: Ver el estado de un smart contract en un momento específico
3. **Verificación de Transacciones**: Confirmar que una transacción se procesó correctamente
4. **Auditoría**: Rastrear cambios en el estado a lo largo del tiempo

### Ejemplo Práctico:

```typescript
// Consultar balance de la dirección 0xa71355 en el bloque 1000
const block1000StateRoot = "0xabc123...";
const balance = getBalanceAtBlock("0xa71355", block1000StateRoot);
// Retorna: 45.0ETH (balance en ese momento)

// Consultar balance en el bloque 1001
const block1001StateRoot = "0xdef456...";
const balance = getBalanceAtBlock("0xa71355", block1001StateRoot);
// Retorna: 50.0ETH (balance después de una transacción)
```

### Ventajas del StateRoot:

- **Inmutabilidad**: El estado de cada bloque es inmutable y verificable
- **Eficiencia**: No necesitas descargar todo el estado, solo el hash raíz
- **Verificación**: Puedes verificar que un nodo te está dando información correcta
- **Historial Completo**: Acceso al estado completo de Ethereum en cualquier punto del tiempo

## Valor en Branch Nodes

### Casos de Uso:

1. **Claves que son Prefijos de Otras**: Cuando una clave es el prefijo exacto de otras claves más largas
2. **Optimización de Memoria**: Evita crear nodos Leaf innecesarios para claves que terminan en un Branch Node
3. **Estructuras de Datos Anidadas**: Permite almacenar valores en diferentes niveles del trie

### Ejemplo:

```
Clave: "a7" → Valor: "Prefijo común"
Clave: "a71" → Valor: "Sub-prefijo"
Clave: "a713" → Valor: "Sub-sub-prefijo"
Clave: "a7135" → Valor: "Prefijo final"
Clave: "a71355" → Valor: "Clave completa"
```

En este caso, el Branch Node en "a7" podría almacenar "Prefijo común", mientras que "a71355" se almacenaría en un Leaf Node.

### Implementación:

En nuestro código, el valor del Branch Node se accede cuando `remainingKey.length === 0`, es decir, cuando se ha navegado completamente por la clave y se llega exactamente a ese nodo.

## Codificación de Prefijos

El MPT utiliza un sistema de codificación de prefijos según el estándar de Ethereum:

- **0**: Extension Node con número par de nibbles
- **1**: Extension Node con número impar de nibbles  
- **2**: Leaf Node con número par de nibbles
- **3**: Leaf Node con número impar de nibbles

## API Principal

### Constructor
```typescript
const trie = new MerklePatriciaTrie();
```

### Inserción
```typescript
trie.insert(key: string, value: string): void
```
Inserta un par clave-valor en el trie.

### Búsqueda
```typescript
trie.get(key: string): string | null
```
Busca y retorna el valor asociado a una clave, o `null` si no existe.

### Hash Raíz
```typescript
trie.getRootHash(): string
```
Retorna el hash KECCAK256 del nodo raíz del trie.

### Visualización
```typescript
trie.printTrie(): void
```
Imprime la estructura completa del trie para debugging.

## Ejemplo de Uso

```typescript
// Crear el trie
const trie = new MerklePatriciaTrie();

// Insertar datos
trie.insert('a71355', '45.0ETH');
trie.insert('a77d337', '1.00WEI');
trie.insert('a7f9365', '1.1ETH');
trie.insert('a77d397', '0.12ETH');

// Visualizar estructura
trie.printTrie();

// Obtener hash raíz
console.log('Root Hash:', trie.getRootHash());

// Buscar valores
console.log('a71355:', trie.get('a71355'));     // 45.0ETH
console.log('a77d337:', trie.get('a77d337'));   // 1.00WEI
console.log('a7f9365:', trie.get('a7f9365'));   // 1.1ETH
console.log('a77d397:', trie.get('a77d397'));   // 0.12ETH
console.log('xyz:', trie.get('xyz'));           // null
```

## Algoritmo de Inserción

1. **Conversión a Nibbles**: La clave se convierte a un array de nibbles (4 bits cada uno)
2. **Búsqueda de Prefijo Común**: Se busca el prefijo común más largo con nodos existentes
3. **División de Nodos**: Si es necesario, se dividen nodos existentes para acomodar la nueva clave
4. **Creación de Nodos**: Se crean nuevos nodos (Branch, Extension, Leaf) según sea necesario
5. **Actualización de Referencias**: Se actualizan las referencias entre nodos

## Algoritmo de Búsqueda

1. **Navegación por Prefijos**: Se navega por el trie siguiendo los nibbles de la clave
2. **Comparación de Nodos**: Se comparan los tipos de nodos y sus contenidos
3. **Reconstrucción de Claves**: Para nodos Leaf, se reconstruye la clave completa para comparación
4. **Retorno de Valores**: Se retorna el valor si se encuentra la clave, o `null` si no existe

## Casos de Uso

### Ethereum
- Almacenamiento de balances de cuentas
- Verificación de transacciones
- Estado de contratos inteligentes
- Pruebas de Merkle para light clients

### Aplicaciones Generales
- Bases de datos con verificación criptográfica
- Sistemas de versionado inmutable
- Verificación de integridad de datos distribuidos
- Almacenamiento eficiente de claves con prefijos comunes

## Ventajas

- **Eficiencia**: Operaciones rápidas independientemente del tamaño del dataset
- **Verificación**: Cada nodo tiene un hash único para verificación de integridad
- **Compresión**: Reduce significativamente el almacenamiento para claves con prefijos comunes
- **Escalabilidad**: Funciona eficientemente con grandes volúmenes de datos

## Limitaciones

- **Complejidad**: La implementación es más compleja que estructuras de datos simples
- **Overhead**: Cada nodo requiere el cálculo de un hash criptográfico
- **Memoria**: Los nodos internos pueden consumir más memoria que arrays simples

## Dependencias

- **js-sha3**: Para el cálculo de hashes KECCAK256
- **TypeScript**: Para tipado estático y mejor desarrollo

## Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar el código
npx tsx index.ts

# O compilar y ejecutar
npx tsc
node index.js
```

## Estructura del Trie Generado

Para el ejemplo proporcionado, el trie se estructura de la siguiente manera:

```
Extension Node (a7)
└── Branch Node
    ├── [1]: Leaf Node (355 → 45.0ETH)
    ├── [7]: Extension Node (d3)
    │   └── Branch Node
    │       ├── [3]: Leaf Node (7 → 1.00WEI)
    │       └── [9]: Leaf Node (7 → 0.12ETH)
    └── [f]: Leaf Node (f9365 → 1.1ETH)
```

Esta estructura optimiza el almacenamiento compartiendo el prefijo común `a7` y organizando eficientemente las claves restantes.

## Contribuciones

Este proyecto es una implementación educativa del Merkle Patricia Trie. Las contribuciones son bienvenidas para mejorar la eficiencia, agregar funcionalidades o corregir bugs.

## Licencia

Este proyecto está disponible bajo la licencia MIT.
