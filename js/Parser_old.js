
class  Parser {

    

   
    processExpression(part, inner = false) {
        const char = this.char;
        const char2 = this.char2;
    
        const isExpression = part.startsWith(char2[0]);
    
        if (!isExpression && !inner) return part;
  
  
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
            content.originalArgs = args;
            if( !content.args){
  
                 //check if has dynamic content
                if(args.includes("(") || args.includes("{{")){
                      args = args.replaceAll(/\(|\)/g, ( s)=>{
                          return s == "(" ? "{{" : "}}"
                      })
                      args = this.compile(args);
                }else{
                      args = this.parseArguments(args, content);
                }
    
                content.args = args;
             
            }
    
        }
    
        return content;
      }

      parseArguments(args, exp){

        // args = args.trim().split(/\s+/ );
        //improved for named args
        //reg with no lookbehind: \S+?(?:\s*?=(?:'.+?[^\\]'|\".+?[^\\]\"))?(?=\s+?|$) //can't scape in php
        
        const matches = args.trim().match(/\.|\S{2,}?(?:\s*?=(?:'.+?[^\\]'|\".+?[^\\]\"))?(?=\s+?|$)/g)


        let len = exp?.helperFn?.length - 1 || 0
        console.log( exp.name, exp?.helperFn?.length , len)
        const ordered = Array.from(Array(len))
        const named = {}
        //loop over all the arguments
        let orderIndex = 0

    
        debugger
        if(matches){

            matches.forEach((arg, i) => {

                const original = arg
             
            
              //named
              let name = false
              if(arg.includes("=")){
                  const s = arg.match(/(.+?)=(.+)/);
                  name = s[1]
                  arg = s[2]
              }
    
              //if doesn't fit more values in the ordered array
              if(!name && orderIndex > (len - 1)){
                return
              }
    
    
                //STRING
              if (arg.startsWith('"') || arg.startsWith("'")) {
                  arg = arg.slice(1, -1);     
              }
              //context
                else if(arg == "."){
                    //just skip
                    //arg = arg
                }
              //PATH
              else{
                arg = arg.split(".")
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
        }



        const allArgs = {ordered, named}
        if(exp.filterArgs){

            exp.filterArgs(allArgs)
        }
        return allArgs

   

    }

    analizeUntil( reqOrString, source){


        let match = source.match(reqOrString);
        if(!match) return [false, source.length]
        let keep = true
        let i = 0
        let s = ""
        let max = source.length
        let stack = 0
        while(keep){
            const char = source[i];

            //if there is match and process brackets is closed, that's the point
            if(match.index == i){
                //everything is closed
                if(stack == 0) {
                    keep = false
                    break;
                }
                //try from new position later
                else{
                   
                    const offset = match[0].length
                    const newMatch = source.slice(i + offset).match(reqOrString);
                    newMatch.index = match.index + offset + newMatch.index
                    match = newMatch
                }

       
            }
            //save state of openining and closing brackets
            if(char == "{")  stack++;
            if(char == "}")  stack--;

        
            if(i == max){
                keep = false
            }
            s += char;
            i++;
        
        }

        if(stack !== 0){

            debugger
            throw new Error("Bracket not closed ")
        }
        return [s, i]

    }
    parse(str) {
        
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
        // const reg = /({{{?|}}(?=.*}})|(?:\(|\))(?=.*}})|}}}?(?=[^}]|$))/
        const reg = /{{/
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

        const debug = {
            part:[],
            content:[]
        }
        
        const stack = split;
        const inStack = [];
        let doingStringArgument = false; 
        let s = str
        while(s){
            if(s === "") {
                break;
            }
        
            let part
            
            //opening
            if(s[0]== "{" && s[1] == "{"){
                ////find close argument
                const [val, end] = this.analizeUntil( /}}(?:(?!})|(?=$))/, s.slice(2))

                if(!val) debugger
                part = `{{${val}}}`
                let ori = s
                s = s.slice(end+4)

                if(s[0] == "}" && s[1] == "}" && s[2] !== "}") debugger
            }

            //default
            else {
                //find next expression
                if(s[0] == "}" && s[1] == "}" && s[2] !== "}") debugger
                const [val, end] = this.analizeUntil( /{{/, s)
                
                if(val){
                    part = val
                }else{
                    part = s
                }
   
                s = s.slice(end )
            }
      
            console.log("PART:::", part)

            debug.part.push(part)

            const content = this.processExpression(part);
            
            debug.content.push(part)

            const openNewBlock = content.close;
        
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
        }
    
    
        debug.template = template
         console.log(debug, split)
    
        const r = this.saveTemplate(originalStr, template);
    
        if (run) {
            return this.filterValue(result, true);
        }
        return r;

    }


  }