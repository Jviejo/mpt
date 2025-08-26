import { keccak256 } from 'js-sha3';

// Tipos de nodos según el diagrama
const NodeType = {
  EXTENSION: 0, // Prefijo 0 para Extension Node (número par de nibbles)
  EXTENSION_ODD: 1, // Prefijo 1 para Extension Node (número impar de nibbles) 
  LEAF_EVEN: 2, // Prefijo 2 para Leaf Node (número par de nibbles)
  LEAF_ODD: 3 // Prefijo 3 para Leaf Node (número impar de nibbles)
};

// Interfaz para nodos del trie
interface TrieNode {
  type: 'branch' | 'extension' | 'leaf';
  hash?: string;
}

// Nodo Branch: array de 17 elementos (16 para hex + 1 para valor)
interface BranchNode extends TrieNode {
  type: 'branch';
  children: (TrieNode | null)[];
  value: string | null;
}

// Nodo Extension: contiene prefijo compartido y referencia al siguiente nodo
interface ExtensionNode extends TrieNode {
  type: 'extension';
  prefix: number; // Tipo de prefijo (0 o 1)
  sharedNibbles: string;
  nextNode: TrieNode;
}

// Nodo Leaf: contiene el final de la clave y el valor
interface LeafNode extends TrieNode {
  type: 'leaf';
  prefix: number; // Tipo de prefijo (2 o 3)
  keyEnd: string;
  value: string;
}

class MerklePatriciaTrie {
  private root: TrieNode | null = null;

  constructor() {}

  // Convierte string a nibbles (4 bits cada uno)
  private stringToNibbles(str: string): string[] {
    // Si el string parece ser hexadecimal (solo contiene 0-9, a-f, A-F)
    if (/^[0-9a-fA-F]+$/.test(str)) {
      return str.toLowerCase().split('');
    }
    
    // Si no es hexadecimal, convertir cada carácter a su código ASCII
    const nibbles: string[] = [];
    for (let i = 0; i < str.length; i++) {
      const byte = str.charCodeAt(i);
      nibbles.push(((byte >> 4) & 0xF).toString(16));
      nibbles.push((byte & 0xF).toString(16));
    }
    return nibbles;
  }

  // Codifica el prefijo según las reglas de Ethereum
  private encodePrefix(nibbles: string[], isLeaf: boolean): { prefix: number; encodedNibbles: string } {
    const isOdd = nibbles.length % 2 === 1;
    
    let prefix: number;
    if (isLeaf) {
      prefix = isOdd ? NodeType.LEAF_ODD : NodeType.LEAF_EVEN;
    } else {
      prefix = isOdd ? NodeType.EXTENSION_ODD : NodeType.EXTENSION;
    }

    // Si es impar, agregar un 0 al principio para hacer par
    let encodedNibbles = nibbles.join('');
    if (isOdd) {
      encodedNibbles = '0' + encodedNibbles;
    }

    return { prefix, encodedNibbles };
  }

  // Encuentra el prefijo común entre dos arrays de nibbles
  private findCommonPrefix(nibbles1: string[], nibbles2: string[]): string[] {
    const common: string[] = [];
    const minLength = Math.min(nibbles1.length, nibbles2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (nibbles1[i] === nibbles2[i]) {
        common.push(nibbles1[i]);
      } else {
        break;
      }
    }
    
    return common;
  }

  // Crea un nodo Branch
  private createBranchNode(value: string | null = null): BranchNode {
    return {
      type: 'branch',
      children: new Array(16).fill(null),
      value
    };
  }

  // Crea un nodo Extension
  private createExtensionNode(sharedNibbles: string[], nextNode: TrieNode): ExtensionNode {
    const { prefix } = this.encodePrefix(sharedNibbles, false);
    
    return {
      type: 'extension',
      prefix,
      sharedNibbles: sharedNibbles.join(''), // Store the nibbles as a joined string
      nextNode
    };
  }

  // Crea un nodo Leaf
  private createLeafNode(keyEnd: string[], value: string): LeafNode {
    const { prefix } = this.encodePrefix(keyEnd, true);
    
    return {
      type: 'leaf',
      prefix,
      keyEnd: keyEnd.join(''), // Store the nibbles as a joined string
      value
    };
  }

  // Calcula el hash KECCAK256 de un nodo
  private calculateNodeHash(node: TrieNode): string {
    let nodeData: string;

    switch (node.type) {
      case 'branch':
        const branchNode = node as BranchNode;
        const childHashes = branchNode.children.map(child => 
          child ? this.calculateNodeHash(child) : ''
        );
        nodeData = childHashes.join('') + (branchNode.value || '');
        break;

      case 'extension':
        const extNode = node as ExtensionNode;
        const nextHash = this.calculateNodeHash(extNode.nextNode);
        nodeData = `${extNode.prefix}${extNode.sharedNibbles}${nextHash}`;
        break;

      case 'leaf':
        const leafNode = node as LeafNode;
        nodeData = `${leafNode.prefix}${leafNode.keyEnd}${leafNode.value}`;
        break;

      default:
        nodeData = '';
    }

    return keccak256(nodeData);
  }

  // Inserta un par clave-valor en el trie
  public insert(key: string, value: string): void {
    const keyNibbles = this.stringToNibbles(key);
    console.log(`DEBUG: Insertando clave '${key}', nibbles: [${keyNibbles.join(', ')}]`);
    
    if (!this.root) {
      this.root = this.createLeafNode(keyNibbles, value);
      return;
    }

    this.root = this.insertRecursive(this.root, keyNibbles, value, 0);
  }

  private insertRecursive(node: TrieNode, keyNibbles: string[], value: string, depth: number): TrieNode {
    const remainingKey = keyNibbles.slice(depth);
    console.log(`DEBUG: insertRecursive - tipo: ${node.type}, depth: ${depth}, remainingKey: [${remainingKey.join(', ')}]`);

    switch (node.type) {
      case 'leaf':
        return this.insertIntoLeaf(node as LeafNode, remainingKey, value);

      case 'extension':
        return this.insertIntoExtension(node as ExtensionNode, remainingKey, value, depth);

      case 'branch':
        return this.insertIntoBranch(node as BranchNode, remainingKey, value);

      default:
        throw new Error('Tipo de nodo desconocido');
    }
  }

  private insertIntoLeaf(leafNode: LeafNode, remainingKey: string[], value: string): TrieNode {
    const leafKeyNibbles = leafNode.keyEnd.split('');
    const commonPrefix = this.findCommonPrefix(leafKeyNibbles, remainingKey);

    if (commonPrefix.length === leafKeyNibbles.length && commonPrefix.length === remainingKey.length) {
      // Misma clave, actualizar valor
      return this.createLeafNode(remainingKey, value);
    }

    // Crear nodo branch
    const branchNode = this.createBranchNode();

    if (commonPrefix.length < leafKeyNibbles.length) {
      const leafRemainingKey = leafKeyNibbles.slice(commonPrefix.length);
      const leafIndex = parseInt(leafRemainingKey[0], 16);
      branchNode.children[leafIndex] = this.createLeafNode(leafRemainingKey.slice(1), leafNode.value);
    }

    if (commonPrefix.length < remainingKey.length) {
      const newRemainingKey = remainingKey.slice(commonPrefix.length);
      const newIndex = parseInt(newRemainingKey[0], 16);
      branchNode.children[newIndex] = this.createLeafNode(newRemainingKey.slice(1), value);
    }

    if (commonPrefix.length > 0) {
      return this.createExtensionNode(commonPrefix, branchNode);
    }

    return branchNode;
  }

  private insertIntoExtension(extNode: ExtensionNode, remainingKey: string[], value: string, depth: number): TrieNode {
    const extNibbles = extNode.sharedNibbles.split('');
    const commonPrefix = this.findCommonPrefix(extNibbles, remainingKey);

    if (commonPrefix.length === extNibbles.length) {
      // El prefijo coincide completamente, continuar con el siguiente nodo
      const newNextNode = this.insertRecursive(extNode.nextNode, remainingKey.slice(commonPrefix.length), value, 0);
      return this.createExtensionNode(extNibbles, newNextNode);
    }

    // Prefijo parcial, necesita dividirse
    const branchNode = this.createBranchNode();
    const extRemainingKey = extNibbles.slice(commonPrefix.length);
    const newRemainingKey = remainingKey.slice(commonPrefix.length);

    if (extRemainingKey.length > 0) {
      const extIndex = parseInt(extRemainingKey[0], 16);
      if (extRemainingKey.length > 1) {
        branchNode.children[extIndex] = this.createExtensionNode(extRemainingKey.slice(1), extNode.nextNode);
      } else {
        branchNode.children[extIndex] = extNode.nextNode;
      }
    }

    if (newRemainingKey.length > 0) {
      const newIndex = parseInt(newRemainingKey[0], 16);
      // Crear un Leaf con la clave completa (incluyendo el primer nibble)
      branchNode.children[newIndex] = this.createLeafNode(newRemainingKey, value);
    }

    if (commonPrefix.length > 0) {
      return this.createExtensionNode(commonPrefix, branchNode);
    }

    return branchNode;
  }

  private insertIntoBranch(branchNode: BranchNode, remainingKey: string[], value: string): TrieNode {
    console.log(`DEBUG: insertIntoBranch - remainingKey: [${remainingKey.join(', ')}], value: ${value}`);
    if (remainingKey.length === 0) {
      branchNode.value = value;
      return branchNode;
    }

    const index = parseInt(remainingKey[0], 16);
    const restKey = remainingKey.slice(1);
    console.log(`DEBUG: insertIntoBranch - index: ${index} (0x${index.toString(16)}), restKey: [${restKey.join(', ')}]`);

    if (!branchNode.children[index]) {
      console.log(`DEBUG: insertIntoBranch - creando nuevo Leaf en índice ${index}`);
      // Crear un Leaf con la clave completa (incluyendo el primer nibble)
      branchNode.children[index] = this.createLeafNode(remainingKey, value);
    } else {
      console.log(`DEBUG: insertIntoBranch - insertando recursivamente en hijo existente en índice ${index}`);
      branchNode.children[index] = this.insertRecursive(branchNode.children[index]!, restKey, value, 0);
    }

    return branchNode;
  }

  // Busca un valor por su clave
  public get(key: string): string | null {
    if (!this.root) return null;

    const keyNibbles = this.stringToNibbles(key);
    console.log(`DEBUG: Buscando clave '${key}', nibbles: [${keyNibbles.join(', ')}]`);
    return this.getRecursive(this.root, keyNibbles, 0);
  }

  private getRecursive(node: TrieNode, keyNibbles: string[], depth: number): string | null {
    const remainingKey = keyNibbles.slice(depth);

    switch (node.type) {
      case 'leaf':
        const leafNode = node as LeafNode;
        // Convert the stored keyEnd string back to nibbles for comparison
        const leafKeyNibbles = leafNode.keyEnd.split('');
        console.log(`DEBUG: getRecursive leaf - leafKeyEnd: ${leafNode.keyEnd}, leafKeyNibbles: [${leafKeyNibbles.join(', ')}], remainingKey: [${remainingKey.join(', ')}]`);
        
        // Para Leaf Nodes, comparar con la clave completa almacenada
        // Si remainingKey es más corto que leafKeyNibbles, agregar el nibble del índice del Branch Node
        let keyToCompare = remainingKey;
        if (remainingKey.length < leafKeyNibbles.length) {
          // Agregar el nibble del índice del Branch Node al principio
          const branchIndex = this.findBranchIndex(keyNibbles, depth - 1);
          if (branchIndex !== null) {
            keyToCompare = [branchIndex.toString(16), ...remainingKey];
          }
        }
        
        const isEqual = this.arraysEqual(leafKeyNibbles, keyToCompare);
        console.log(`DEBUG: getRecursive leaf - keyToCompare: [${keyToCompare.join(', ')}], arraysEqual: ${isEqual}`);
        return isEqual ? leafNode.value : null;

      case 'extension':
        const extNode = node as ExtensionNode;
        // Convert the stored sharedNibbles string back to nibbles for comparison
        const extNibbles = extNode.sharedNibbles.split('');
        console.log(`DEBUG: getRecursive extension - extNibbles: [${extNibbles.join(', ')}], remainingKey: [${remainingKey.join(', ')}]`);
        if (remainingKey.length < extNibbles.length || 
            !this.arraysEqual(extNibbles, remainingKey.slice(0, extNibbles.length))) {
          return null;
        }
        return this.getRecursive(extNode.nextNode, keyNibbles, depth + extNibbles.length);

      case 'branch':
        const branchNode = node as BranchNode;
        console.log(`DEBUG: getRecursive branch - remainingKey: [${remainingKey.join(', ')}], depth: ${depth}`);
        if (remainingKey.length === 0) {
          return branchNode.value;
        }
        const index = parseInt(remainingKey[0], 16);
        console.log(`DEBUG: getRecursive branch - index: ${index} (0x${index.toString(16)})`);
        const child = branchNode.children[index];
        console.log(`DEBUG: getRecursive branch - child exists: ${!!child}, child type: ${child?.type}`);
        return child ? this.getRecursive(child, keyNibbles, depth + 1) : null;

      default:
        return null;
    }
  }

  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }

  // Encuentra el índice del Branch Node basado en la profundidad
  private findBranchIndex(keyNibbles: string[], depth: number): number | null {
    if (depth < 0 || depth >= keyNibbles.length) return null;
    return parseInt(keyNibbles[depth], 16);
  }

  // Obtiene el hash raíz del trie
  public getRootHash(): string {
    if (!this.root) return keccak256('');
    return this.calculateNodeHash(this.root);
  }

  // Método para visualizar la estructura del trie
  public printTrie(): void {
    if (!this.root) {
      console.log('Trie vacío');
      return;
    }
    this.printNode(this.root, '', 0);
  }

  private printNode(node: TrieNode, prefix: string, depth: number): void {
    const indent = '  '.repeat(depth);
    
    switch (node.type) {
      case 'branch':
        const branchNode = node as BranchNode;
        console.log(`${indent}Branch Node:`);
        if (branchNode.value) {
          console.log(`${indent}  Value: ${branchNode.value}`);
        }
        branchNode.children.forEach((child, index) => {
          if (child) {
            console.log(`${indent}  [${index.toString(16)}]:`);
            this.printNode(child, prefix + index.toString(16), depth + 1);
          }
        });
        break;

      case 'extension':
        const extNode = node as ExtensionNode;
        console.log(`${indent}Extension Node:`);
        console.log(`${indent}  Prefix: ${extNode.prefix}`);
        console.log(`${indent}  Shared Nibbles: ${extNode.sharedNibbles}`);
        console.log(`${indent}  Next Node:`);
        this.printNode(extNode.nextNode, prefix, depth + 1);
        break;

      case 'leaf':
        const leafNode = node as LeafNode;
        console.log(`${indent}Leaf Node:`);
        console.log(`${indent}  Prefix: ${leafNode.prefix}`);
        console.log(`${indent}  Key End: ${leafNode.keyEnd}`);
        console.log(`${indent}  Value: ${leafNode.value}`);
        break;
    }
  }
}

// Ejemplo de uso siguiendo el diagrama
const trie = new MerklePatriciaTrie();

// Insertamos los datos del ejemplo del diagrama
trie.insert('a71355', '45.0ETH');  // Clave que termina en 1355
trie.insert('a77d337', '1.00WEI'); // Clave que termina en 7d337  
trie.insert('a7f9365', '1.1ETH');  // Clave que termina en f9365
trie.insert('a77d397', '0.12ETH'); // Clave que termina en 7d397

console.log('=== Estructura del Merkle Patricia Trie ===');
trie.printTrie();

console.log('\n=== Hash raíz ===');
console.log('Root Hash:', trie.getRootHash());

console.log('\n=== Búsquedas ===');
console.log('a71355:', trie.get('a71355'));
console.log('a77d337:', trie.get('a77d337'));
console.log('a7f9365:', trie.get('a7f9365'));
console.log('a77d397:', trie.get('a77d397'));
console.log('clave inexistente:', trie.get('xyz'));

export { MerklePatriciaTrie, NodeType };