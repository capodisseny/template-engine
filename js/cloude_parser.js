class Parser {
    constructor(template) {
      this.template = template;
      this.pos = 0;
      this.length = template.length;
    }
  
    parse() {
      const nodes = [];
      while (this.pos < this.length) {
        const startTag = this.consumeUntil('{{');
        if (startTag.length > 0) {
          nodes.push({ type: 'text', value: startTag });
        }
        if (this.pos >= this.length) break;
        
        // Move past '{{'
        this.pos += 2;
        
        // Check if it's a block expression
        const isBlock = this.peek() === '#';
        if (isBlock) this.pos++;
        
        const expression = this.parseExpression();
        if (!expression) break;
        
        if (isBlock) {
          const blockContent = this.parseBlockContent(expression.name);
          nodes.push({
            type: 'block',
            name: expression.name,
            args: expression.args,
            content: blockContent
          });
        } else {
          nodes.push({
            type: 'expression',
            ...expression
          });
        }
      }
      return nodes;
    }
  
    parseExpression() {
      const parts = [];
      let inQuote = null;
      let current = '';
      let parenCount = 0;
  
      while (this.pos < this.length) {
        const char = this.template[this.pos];
        
        // Handle quotes
        if ((char === '"' || char === "'") && this.template[this.pos - 1] !== '\\') {
          if (!inQuote) {
            inQuote = char;
          } else if (char === inQuote) {
            inQuote = null;
          }
        }
        
        // Handle nested parentheses
        if (!inQuote) {
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
        }
        
        // Check for expression end
        if (!inQuote && parenCount === 0 && this.template.substr(this.pos, 2) === '}}') {
          if (current.trim()) parts.push(current.trim());
          this.pos += 2;
          break;
        }
        
        // Handle spaces outside quotes and parentheses
        if (!inQuote && parenCount === 0 && char === ' ' && current.trim()) {
          parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
        
        this.pos++;
      }
  
      if (!parts.length) return null;
  
      const name = parts[0];
      const args = parts.slice(1).map(arg => {
        if (arg.startsWith('"') || arg.startsWith("'")) {
          // String argument
          return {
            type: 'string',
            value: arg.slice(1, -1)
          };
        } else if (arg.startsWith('(') && arg.endsWith(')')) {
          // Subexpression
          return {
            type: 'subexpression',
            value: arg.slice(1, -1)
          };
        } else {
          // Getter path
          return {
            type: 'getter',
            path: arg.split('.')
          };
        }
      });
  
      return { name, args };
    }
  
    parseBlockContent(blockName) {
      const content = [];
      let nestedCount = 0;
  
      while (this.pos < this.length) {
        const startTag = this.consumeUntil('{{');
        if (startTag.length > 0) {
          content.push({ type: 'text', value: startTag });
        }
        if (this.pos >= this.length) break;
  
        this.pos += 2;
        
        // Check for block end
        if (this.peek() === '/') {
          this.pos++;
          const endName = this.consumeUntil('}}');
          if (endName.trim() === blockName && nestedCount === 0) {
            this.pos += 2;
            break;
          }
        }
        
        // Check for nested blocks
        if (this.peek() === '#') {
          nestedCount++;
        } else if (this.peek() === '/') {
          nestedCount--;
        }
        
        // Parse nested expression
        this.pos -= 2; // Move back to include '{{' in nested parse
        const expression = this.parseExpression();
        if (expression) {
          content.push({
            type: 'expression',
            ...expression
          });
        }
      }
  
      return content;
    }
  
    peek() {
      return this.template[this.pos];
    }
  
    consumeUntil(str) {
      let result = '';
      while (this.pos < this.length) {
        if (this.template.substr(this.pos, str.length) === str) {
          break;
        }
        result += this.template[this.pos];
        this.pos++;
      }
      return result;
    }
  }
  
  // Helper function to compile template to AST
  function compileToAST(template) {
    const parser = new Parser(template);
    return parser.parse();
  }

  