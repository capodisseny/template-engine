// Define constants
const ENGINE_RETURN_EMPTY =  Symbol();
const ENGINE_IS_FIRST =  Symbol();
const ENGINE_IS_LAST =  Symbol();
const ENGINE_NO_CARRY =  Symbol();
const ENGINE_VALUE_UNDEFINED =  Symbol();


// Class Definition
class TemplateEngine {
    constructor() {
  
      this.helpers = {};
      this.templates = new Map();
      this.compilers = [];
      this.char = ["{", "}"];
      this.block = ["#", "/"];
      this.partial = ">";
      this.returnArrayOrValue = false; 
      this.precompileId = 0;
  
      this.precompilers = {};
  
      this.char2 = this.char.map((char) => char + char);
      this.char3 = this.char.map((char) => char + char + char);
  
      // Initialize helpers
      this.setDefaultHelpers()
  
     
    }
  
    setDefaultHelpers() {
  
      this.registerHelper("wp", {
          render: (args, context, render, exp) => { 
              debugger
              return "custom render"
          },
        });
      this.registerHelper("each", {
          render: function(loop, options) {

            const args = options.args

            if (!Array.isArray(loop)) return "";
    
            const joint = args.joint || "";

            let source = [];
            loop.forEach((value, k) => {
                let v
                if(!options.fn){
                    v = value
                }
                //block
                else{
                     v = options.fn(value);
                }

                console.log("v", v)
                source.push(v)
            });
            return source.join(joint);

           
            
          },
        });
    
        this.registerHelper("if", {

          render: function(condition, val, defaultVal, options) {

            if (!options.fn) {
                if (condition){
                    return val;
                } else{
                    return defaultVal || ENGINE_RETURN_EMPTY;
                }
              
            } else {
                if (!condition) return  ENGINE_RETURN_EMPTY;
              return options.fn(this);
            }
          },
        });
    
        this.registerHelper("else", {
            filterArgs(args){
                //set tsame value as parent
               args.ordered[0] =  this.parent.args.ordered[0];
            },
          render: function (yes, condition, check, val ,  options) {
  
            if (yes) return ENGINE_RETURN_EMPTY;

            if(!options){
                debugger
            }
            //else if
            if(condition == "if" && !check){
                return ENGINE_RETURN_EMPTY;
            }

            //default else
            if(options.fn) {
                if(typeof options.fn !== "function"){
                    debugger
                }
                return  options.fn(this)
            }

            return val;
          },
          compiler: (block, parentBlock, args) => {
  
              Object.assign(block, {
                  type: "block",
                
                })
          
          },
        });
    
        this.registerHelper("toJSON", function (json, options) {
          if (!options.fn) {
            return JSON.stringify(json);
          }
        });
    
        this.registerHelper("js", {
            compileArgs: (args) => args,
            getArgs: (args) => ({ordered:args}),
            render: function(code) {
                let ids = 0;
                const id = "exp_" + ids;
                this.jsExpressions = this.jsExpressions || {};
                this.jsExpressions[id] = code;
                ids++;
                return `{{js ${id}}}`;
            },
        });
    }
  
    getArgs(exp, args, context) {
    
        if(exp.getArgs) return exp.getArgs(args, context);
    
        //compiled args
        if(typeof args == "function"  ) {
            
            args = args(context);
            args = args.split(/\s+/);
        }


        const named = {};
        const orderedArgs = args["ordered"] ?? [];
        const namedArgs = args["named"] ?? [];
        
        Object.keys(namedArgs).forEach((name)=>{
            let arg = namedArgs[name]
            let value;
            if(!value) value = value;
            else if(arg == ".")  value =  context;
            else if(typeof arg == "string")  value = arg;
            else value = this.get(arg, context);

            named[name] = value;
        })  

        const ordered = orderedArgs.map(arg=>{
            let value;
            if(!value) value = value
            else if(arg == ".")  value =  context;
            else if(typeof arg == "string")  value =  arg;
            else value = this.get(arg, context);

            return value

        })
        
      
      return {named, ordered};






    }
  
    registerCompiler(id, callback) {
      this.compilers[id] = callback;
    }
  
    getCompiler(helper) {
      if (helper && typeof helper === "object") {
        return helper.compiler || false;
      }
    }
  
    registerHelper(id, callbackOrOptions) {
      this.helpers[id] = callbackOrOptions;
    }
  
    getHelper(id) {
      return this.helpers[id] || false;
    }
  
    saveTemplate(string, template) {
  
      const fn = (context = {}, returnArrayOrValue = this.returnArrayOrValue) => {
          this.returnArrayOrValue = returnArrayOrValue;
          return this.renderPart(template, context);
      }
      this.templates.set(string, fn);
  
      return fn;
    }
  
    getTemplate(string) {
  
      return this.templates.get(string);
    }
  
    handlePrecompilation() {
      const precompiler = this.precompilers[this.precompileId];
      const callback = precompiler.callback;
      const args = arguments;
  
      this.precompilations[this.precompileId] = {
        callback,
        args,
      };
      return `{{__pre__${this.precompileId++}}}`;
    }
  
  
    compile(str, run = false, context = []) {
        
        if (!str) return str;
    
        const exist = this.getTemplate(str);
        if (exist) {
            if (run) return exist(context);
            return exist;
        }
    
        const originalStr = str;
    
        if (typeof str !== "string") throw new Error("template is not string");
    
        // Skipping HTML and CSS comment handling for now
        if(this.precompilers){
            //TODO:
            Object.entries(this.precompilers).forEach(([ id, precompiler]) => {
                
                // const reg = precompiler["expression"];
                // this.precompileId = id;
                // str = str.replace(reg, this.handlePrecompilation);
                // precompiler(str) 
            })
            
        }
    
    
        // const reg = /((?:{{{|{{)(?:(?R)|.)+?(?:}}}|}}))/;
        //Js doesn't allow recurson so we need a custom function to find matches equal to php
        // const reg = /({{|}}}|}})/ 
        // const reg = /({{|}})(?=[^}])/
        // const reg = /({{|}}(?=[^}]|$))/
    
        //explanation  find {{{? or inner }} or find inner ) or find }}}?
        const reg = /({{{?|}}(?=.*}})|(?:\(|\))(?=.*}})|}}}?(?=[^}]|$))/
        const split = str.split(reg);
    
        const template = {
            main: true,
            source: originalStr,
            content: [],
        };
        let result = this.returnArrayOrValue ? [] : "";
        this.currentTemplate = template;
    
        const blockStack = [template];
        this.blockStack = blockStack;

        let buildPart = "";
        let innerStack = 0;
        let part = "";
        const debug = {
            part:[],
            content:[]
        }
        
    
        const inStack = [];
        split.forEach((s) => {
    
            if(s === "") return;
            
            //open tag or inner tag
            if(s.slice(0, 2) == "{{" ){

                innerStack++;
                buildPart += s;
                    
            }   
            //close tag or close inner tag
            else if(s.slice(-2) == "}}" ){
                
                innerStack--;
                buildPart += s;

                //reset part
                if(innerStack === 0){
                    part = buildPart;
                    buildPart = ""
                }
            }
            //single string
            else if(innerStack !== 0) buildPart += s;
            
            //default
            else  part = s;
    
    
            if(innerStack < 0){
                throw new Error("Broken block, check for unclosed blocks.");
            }
            
    
            //part is not complete
            if(innerStack !== 0) return ;
            

            console.log(":::PART:::", part, innerStack)
            debug.part.push(part)
    
            //LIKE PHP
            // Process expression
            const content = this.processExpression(part);
            
    
            debug.content.push(part)
            console.log(":::expression:::", content)
    
    
            const openNewBlock = content.close;
    
    
            // Render content when required
            if (run) {
                let render = false;
    
                if (blockStack.length === 2 && openNewBlock) {
                    render = blockStack[blockStack.length - 1];
                }
                if (blockStack.length === 1 && content.type !== "block") {
                    render = content;
                }
                if (render) {
                    const value = this.renderPart(render, context);
                    result = this.joinValue(result, value);
                }
            }
    
            // Remove old block from stack if needed
            if (openNewBlock) {
                blockStack.pop();
            }

            if(content.type === "closeBlock") return;
    
            // Add content to current block
            if (blockStack.length) {
              
                const currentBlock = blockStack[blockStack.length - 1];
                currentBlock.content.push(content);
                
            } else {
                throw new Error("Broken block, check for unclosed blocks.");
            }
    
            //append new block to stack
            if (content.type === "block") {
                blockStack.push(content);
            }
        });
    
    
        debug.template = template
        console.log(debug, split)
    
    
        const r = this.saveTemplate(originalStr, template);
    
        if (run) {
            return this.filterValue(result, true);
        }
        return r;
    }
  
   
    processExpression(part, inner = false) {
      const char = this.char;
      const char2 = this.char2;
  
      const isExpression = part.startsWith(char2[0]);
  
      if (!isExpression && !inner) return part;
  
      // if( inner ){
      //     if(part.slice(0, 1) == "(") part = part.slice(1, -1).trim();
      //     else if(!isExpression){
      //         return part
      //     }else{
      //         part = part.slice(2, -2).trim();
      //     }
  
      // }else{
      //     // from {{some.prop}} to some.prop
      //     part = part.slice(2, -2).trim();
  
      // }
  
      part = part.slice(2, -2).trim();
  
  
  
      //Check first character
      let first = part[0];
      let triple = first === char[0];
      if (triple) {
        part = part.slice(1, -1);
        first = part[0];
      }
  
  
      //then block or inline
      const openBlock = first === this.block[0];
      const closeBlock = first === this.block[1];
      const isInline = !openBlock && !closeBlock;
  
  
     
  
      const isPrecompiled = part.slice( 0, 7) == "__pre__";
  
      const isEnd = closeBlock;
  
      const content = {
          part,
          type:isInline?"inline":"block",
          triple,
          close:isEnd,
          parent: this.blockStack.at(-1),
      }
  
      if( isPrecompiled ){
          content.precompiled =  part.slice( 7, -1);
      }
  
      if(closeBlock) content.type = "closeBlock";
  
      if(!closeBlock ){
  
         
          //remove the block character
          if(openBlock ) part = part.slice(1);
  
          //new first can be the definer (@, >, ...)
          first = part[0];
          
          //if is not letter
          if(!first.match(/^[.a-z0-9$]/i)){
              part = part.slice(1);
          }
  
          //limit in js works different
          //["", "name", "args ...."]
          const s  = part.match(/(\S+)\s*(.+)?/)
          
          const isNamed = s[2] ?? false;
          let name = isNamed ? s[1]:false;
          let args = isNamed ? s[2] : s[1] || "";
  
          //is helper
          if(!name && first == "@"){
              name = args;
          }

          //equivalent to {{name argss}} or {{@name argss}}
          if(!name && args && args.includes("@")){
              const s = args.match(/(.+)@(.+?)$/);
              name = s[2]
              args = s[1]
          }
  

         
          content.name = name;
         
          //HELPER    
          const was = content.type;
          this.setupHelper(name, content, args);
          
          if(was == "inline" && content.type == "block") {
              content.close = true;
          }
  
          //open block
          if(content.type == "block"){
              content.content = []; 
          }
  
          //compile arguments
          if(!content.args){
               //check if has dynamic content
              if(args.includes("(")){
                    args = args.replaceAll("(", "{{").replaceAll(")", "}}");
                    this.compilingArgs = true;
                    args = this.compile(args);
                    this.compilingArgs = false;
              }else{
                
                    args = this.parseArguments(args, content);
              }
  
              content.args = args;
          }
  
      }
  
      return content;
    }
     parseArguments(args, exp){

        args = args.trim().split(/\s+/ );

        const ordered = Array.from(Array(exp?.helperFn?.length - 1 || 0))
        const named = {}
        //loop over all the arguments
        let orderIndex = 0

        args.forEach((arg, i) => {
          //context value
          if(arg === ".") {
                ordered[orderIndex++] = arg;
              return;
          }
          //named
          let name = false
          if(arg.includes("=")){
              const s = arg.match(/(.+?)=(.+)/);
              name = s[1]
              arg = s[2]
          }

            //STRING
          if (arg.startsWith('"') || arg.startsWith("'")) {
              arg = arg.slice(1, -1);     
          }
          //PATH
          else{
            arg = arg.split(/\s+/)
          }

          //Where to save it
          //named
          if(name){
                 named[name] = arg;
              return 
          }
          //ordered
          ordered[orderIndex++] = arg;
  
        })



        const allArgs = {ordered, named}
        if(exp.filterArgs){

            exp.filterArgs(allArgs)
        }
        return allArgs

   

    }
  
    setupHelper(name, content, args) {
  
        let helper = this.getHelper(name);
        if(!helper ) helper = this.getHelper(args);
    
        if (name && !helper) {
            console.error(`Helper not found: '${name}'`);
        }
    
        if(!helper) return;
    
        const compiler = this.getCompiler(helper);
        if (compiler) {
            const parent = this.blockStack.at(-1);
            compiler(content, parent, args);
        }
    
    
        if (helper.compileArgs) {
            content.args = helper.compileArgs(args);
        }

        if (helper.filterArgs) {
                content.filterArgs = helper.filterArgs;
        }
    

        content.render = (context) => this.renderContent(content, context);

        content.helperFn = helper.render || helper
    
    
        return content;
    }
  
    joinValue(carry, value) {
      if (Array.isArray(carry)) {
        carry.push(value);
      } else {
        carry += value;
      }
      return carry;
    }
  
    filterValue(value, last = false) {
  
      if (last) {
          if (Array.isArray(value) && value.length === 1) {
            return value[0]; // Return the single value if only one exists
          }
          return value;
      }
  
      if (value === ENGINE_RETURN_EMPTY) {
        if (this.returnArrayOrValue) return ;
        return "";
      }
  
      if(!this.returnArrayOrValue){
  
          const t = typeof value 
          if (t !== "string") {
              if (t === "function") {
                throw new Error("Value by default is not callable. Use a Helper.");
              }
              if (Array.isArray(value)) {
                return "[ARRAY]";
              }
              if (t === "object") {
                return "[OBJECT]";
              }
              if(!value) return "";
  
              return String(value);
            }
  
       
      }
  
      return value;
    }
  
    renderPart(exp, context) {
  
        if (typeof exp === "string") return exp;
    
        const { helperFn, args = [], type, main } = exp;
        let value;
        if(main) this.currentTemplate = exp;
    
    
  
        //{{some.prop}} 
        if (!helperFn && type === "inline") {
            const parsedArgs = this.getArgs(exp, args, context);
            const ordered = parsedArgs.ordered ||[];
      
            value = ordered[0];
        } 
        //root
        else if (exp.main) {
            value = this.renderContent(exp, context);
        }
        // {{__pre__compileId}} 
        else if (exp.precompiled) {
            value = this.runPrecompilation(exp.precompiled, context);
        }
        //{{helper some.prop}} 
        else if (helperFn) {
            const parsedArgs = this.getArgs(exp, args, context);
            const ordered = parsedArgs.ordered ||[];
            const named = parsedArgs.named ||{};
            value = helperFn.call(context, ...ordered, {context, fn:exp.render, args:named});
        }
        
        // {{#some.prop}}the content{{/some.prop}}
        else {
            const parsedArgs = this.getArgs(exp, args, context);
            const ordered = parsedArgs.ordered ||[];
            if(!ordered[0]) value =  ENGINE_RETURN_EMPTY
            else value = this.renderContent(exp, context);
        }
    
        return this.filterValue(value);
    }
  
    get(path, context) {
        if(!path){
            debugger
            return;
        }
        if( typeof path !== "string" && !Array.isArray(path)){
            debugger
            return
        }

        const steps =  Array.isArray(path)? path : path.split('.');
        // .reduce((acc, part) => acc && acc[part], context);
        let value = context;
        let i = -1;
        const last = steps.length - 1;
        while (i < last) {
            i++
            // const last = index === paths.length - 1;
            if(!value) return;
            value = value?.[steps[i]];
        
        }
        return value;
    }
  
    renderContent(exp, context) {
  
      let result = this.returnArrayOrValue ? [] : "";
  
      if (!exp.content || exp.content.length === 0) return;
  
      exp.content.forEach((c) => {
        let value = this.renderPart(c, context);
        result = this.joinValue(result, value);
      });
  
      return this.filterValue(result, true);
    }
  
    render(templateStr, context = [], returnArrayOrValue = false) {
     // Set the returnArrayOrValue flag before rendering
     this.returnArrayOrValue = returnArrayOrValue;
  
     // Compile and run the template
     const result = this.compile(templateStr, true, context);
  
     // Reset the flag after rendering
     this.returnArrayOrValue = false;
  
     // Return the final result (either a concatenated string or an array)
     return result;
    }
  }
  






// // Example usage:
 engine = new TemplateEngine();
// const engine = new TemplateEngine();
// const ctx = { props: { colors: { main: "#fff" } } };
// const result = engine.render("{{if props.colors.main --swiper-theme-color: {{props.colors.main}}; }}", ctx);
// console.log(result);
export default TemplateEngine