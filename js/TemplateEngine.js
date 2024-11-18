// // Define constants
const ENGINE_RETURN_EMPTY =  Symbol();
const ENGINE_IS_FIRST =  Symbol();
const ENGINE_IS_LAST =  Symbol();
const ENGINE_NO_CARRY =  Symbol();
const ENGINE_VALUE_UNDEFINED =  Symbol();

const ENGINE_STOP_CONTENT =  Symbol();    


function escapeSpecial(value){
    return String(value)
                .replace(/&/g, '&amp;')
                .replace(/'/g, '&#39;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/`/g, '&#96;');


}
/**
 * 
references:
- https://www.npmjs.com/package/curly-bracket-parser
    this one has cool things like:
        - set global variables 
        - nested variables  
            var1= "some {{var2}}" var2 = " nested {{var3}}" ctx = {var2, var3:"holaa"} 
            renders:  some nested holaa 
-https://www.npmjs.com/package/g2-bracket-parser
 */

// import Parser from "Parser.js"
// Class Definition
class TemplateEngine {
   
    constructor(options) {
  
      this.helpers = {};
      this.templates = new Map();
      this.compilers = [];
      this.char = ["{", "}"];
      this.block = ["#", "/"];
      this.partial = ">";
      this.returnArrayOrValue = false; 
      this.precompileId = 0;
      
      this.debug = options?.debug
  
      this.precompilers = {};


      this.options = options || {}

    //   this.parser = new Parser({
    //     filterArguments:this.filterArguments
    //   });
  
      this.char2 = this.char.map((char) => char + char);
      this.char3 = this.char.map((char) => char + char + char);
  
      // Initialize helpers
      this.setDefaultHelpers()

    //   Object.assign(this, new Parser() )
  
    }

    filterArguments(expression, source, process){

        if(expression.compileArgs){


            return expression.compileArgs( source, process, expression)
        }
    }


    // parse(s, options){
    //     return this.parser.parse(s, options);
    // }
  
    setDefaultHelpers() {
  
      this.registerHelper("wp", {
          render: (args, context, render, exp) => { 
              debugger
              return "custom render"
          },
        });

      this.registerHelper("each", {
          render: function(loop, options) {

            const args = options.hash

            if (!Array.isArray(loop)) return "";
    
            const joint = args.joint || "";

            let source = [];
            loop.forEach((value, k) => {
                let v
                if(!options.content){
                    v = value
                }
                //block
                else{
                     v = options.content(value);
                }

                source.push(v)
            });
            return source.join(joint);

           
            
          },
        });
    
        this.registerHelper("if", {

          render: function(condition, val, defaultVal, options) {

            //inline
            if (!options.content) {
                if (condition)  return val;
                return defaultVal;
              
            }
            //block
            if (!condition) return;
            return options.content(this);
          },
        });
        this.registerHelper("random",function(){
            return Math.random()
        })
    
        this.registerHelper("else", {
         
            render: function (yes, condition, check, val ,  options) {    
                //main is true
                if (yes) return;
                // if (yes) return options.stop;

                //false else if
                if(condition == "if" && !check) return ;

                //default else
                if(options.content) {
                    if(typeof options.content !== "function"){
                        debugger
                    }
                    return  options.content(this)
                }

                return val;
            },
            filterExpression(newExp, process){

                //remove {{if}} block or other
                process.stack.pop()
                const parent = process.stack.at(-2)
                process.currentExpression = process.stack.at(-1)
                newExp.type = "block"
                //copy first argument from parent
                newExp.args.list.push(parent.args.list[0])

            },
        
        });
    
        this.registerHelper("toJSON", function (json, options) {
          if (!options.content) {
            const value =  JSON.stringify(json).replace(/}}/g, ' } } ');
            
            return value

          }
        });
    
        this.registerHelper("js", {
            compileArgs: (source, process, exp) => {

               const [js, end] =  this.analizeUntil(/}}/, source)
               exp.args.list = [js]
           

               return source.slice(end)

          
            },
            // getArgs: (args) => ({list:args}),
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
  
    getArgs(exp, context) {
    

        if(exp.getArgs) return exp.getArgs(args, context);
    
        //compiled args
        if(typeof args == "function"  ) {
            
            throw new Error("Invalid arguments", args)
            // const old = this.returnArrayOrValue;
            //  this.returnArrayOrValue = false;
            // args = args(context);
            //  this.returnArrayOrValue = old;

            // args = this.parseArguments(args, exp);
        }

        const hash = {};
        const orderedArgs = exp.args.list ?? [];
      
        const namedArgs = exp.args.hash ?? {};
    
        const listArgs = exp.protoList ?? [];

        Object.keys(namedArgs).forEach((name)=>{

            hash[name] = this.getArgumentValue(namedArgs[name], context)
        })  

        const list = listArgs.map((arg,i)=>{
            if(!orderedArgs.hasOwnProperty(i)) return 
            return  this.getArgumentValue(orderedArgs[i], context)
        })

        if(exp.filterArgs) {
            const check = exp.filterArgs({hash, list},  context)

            if(check !== undefined) return check
        }
        
      return {hash, list};

    }
    getArgumentValue(arg, context){
       
        let value;
        if(!arg?.type)debugger
        const type = arg.type;

        if(type == "string"){
            return arg.value;
        }
        if(type == "getter"){
            if(arg.value == "." ) return context;
            return this.get(arg.value, context);
        }
        if(arg.type == "root"){
            return this.renderContent(arg.content, context);
        }
       
        return value
    }
    filterExpression(newExp, process){

        
        this.setupHelper(newExp.name, newExp, newExp.args)
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

          return this.renderExpression(template, context);
      }
      if(this.debug){
            fn.template = template
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
  
  
   //OLD COMPILER, fails whith json like: {{some '{some:{laca:\"ss\"}}'}}
    compile(str, run = false, context = []) {
        
        if (!str) return ()=>str;
    
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
    
    
    
        let result = this.returnArrayOrValue ? [] : "";


    
        const ast = this.parse(str)

        this.currentTemplate = ast;
    

        // debug.template = ast
        //  console.log(debug)
    
    
        const r = this.saveTemplate(originalStr, ast);
    
        if (run) {
            return this.filterValue(result, true);
        }
        return r;
    }
  
    setupHelper(name, expression, args) {
  
        let helper = this.getHelper(name);
        if(!helper ) helper = this.getHelper(args);
    
       
        if (name && !helper && expression.forceHelper ) {
            console.error(`Helper not found: '${name}'`);
        }
    
        if(!helper ) {
   
            //remove helper name if is not found
            if(!expression.forceHelper){
                expression.getter = expression.name;
                expression.name = false
            }
      
            return;
        }
    
        const compiler = this.getCompiler(helper);
        if (compiler) {

            compiler(expression, args);
        }

        //filter compilation
        if (helper.compileArgs) {
            expression.compileArgs = helper.compileArgs;
        }

        //rebuild the getting args function
        if (helper.getArgs) {
            expression.getArgs = helper.getArgs;
        }

        //filter args
        if (helper.filterArgs) {
            expression.filterArgs = helper.filterArgs;
        }
    
        if(helper.validateContent){
            expression.validateContent = helper.validateContent;
        }

        if(expression.type == "block") expression.renderContent = (context) => this.renderContent(expression.content, context);

        expression.helperFn = helper.render || helper

        if(expression.helperFn){
            const max = expression.helperFn?.length?expression.helperFn?.length - 1: 0;
            expression.protoList = Array.from(Array(max))
        }
        return expression;
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

    
        if(ENGINE_STOP_CONTENT == value) return ENGINE_STOP_CONTENT;
  
        if (last) {
            if (Array.isArray(value) && value.length === 1) {
                return value[0]; // Return the single value if only one exists
            }
            return value;
        }
    
        
        let returnValue = value
        if (value === ENGINE_RETURN_EMPTY) {
            if (this.returnArrayOrValue) returnValue = undefined;
            else returnValue =    "";
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
                if(!value) returnValue =  "";
    
              
            
            }
    
        
        }

        if(this.options?.filterValue){
            returnValue = this.options?.filterValue(returnValue)
        }
    
        return returnValue;
    }

    renderExpression(exp, context) {
  

        if(typeof exp !== "object") {

            throw new Error("Invalid template", exp);
        }
        const { helperFn, type,  } = exp;

        if (type === "string") return exp.value;
        let value;

        if(type == "root") this.currentTemplate = exp;
    
        //{{some.prop}} 
        if (!helperFn && type === "inline") {

            if(exp.getter){
                value = this.get(exp.getter, context)
            }else{

                //TODO: do i need this?
                // const parsedArgs = this.getArgs(exp, context);
                // const list = parsedArgs.list ||[];

    
            }
            

         
            // value = list[0];
        } 
        //root
        else if (type == "root") {
            value = this.renderContent(exp.content, context);
        }
        // {{__pre__compileId}} 
        else if (exp.precompiled) {
            value = this.runPrecompilation(exp.precompiled, context);
        }
        //{{helper some.prop}} 
        else if (helperFn) {
            const {list, hash} = this.getArgs(exp, context);
   
            value = helperFn.call(context, ...list, {context, content:exp.renderContent, hash, stop:ENGINE_STOP_CONTENT, exp, });
        }
        
        //CONTENT
        // {{#some.prop}}the content{{/some.prop}}
        else {
           
            //expression is a getter
            if(exp.getter){
                if(this.get(exp.getter, context)){
                    value = this.renderContent(exp.content, context);
                }

            //TODO check if i need this?
            }else{
                // const parsedArgs = this.getArgs(exp, context);
                // if(!this.validateContent(exp, parsedArgs)) value =  ENGINE_RETURN_EMPTY
                // else value = this.renderContent(exp.content, context);
            }
           
        }


        //handle from SSR
        if(typeof window == "undefined" && value && exp.type == "inline" && exp.first !== "{"){

               value =  escapeSpecial(value)
        }

      
 
 


        return this.filterValue(value);
    }
    renderContent(content, context) {
  
        let result = this.returnArrayOrValue ? [] : "";
    
        if(!content?.length) return 
    
        for(let c of content){

          let value = this.renderExpression(c, context);
  
          //skip empty values
          if(this.returnArrayOrValue ){
              if(typeof value == "string" ){
                  value = value.trim();
                  if(value == "") continue
              } 
              if(value === undefined) continue;
          }
  
          if(value === ENGINE_STOP_CONTENT) break;
  
          result = this.joinValue(result, value);
        }
      
        return this.filterValue(result, true);
      }
    validateContent(exp, parsedArgs){

        if(exp.validateContent){
            return exp.validateContent(parsedArgs);
        }
        return parsedArgs.list[0] ;
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
  
   
  


    render(templateStr, context = {}, returnArrayOrValue = false) {


        if(!templateStr.includes("{{")) return templateStr;

        // Set the returnArrayOrValue flag before rendering
        this.returnArrayOrValue = returnArrayOrValue;
    
        // Compile and run the temanalplate
        const template = this.compile(templateStr);
    
        // Reset the flag after rendering
        this.returnArrayOrValue = false;
    
        // Return the final result (either a concatenated string or an array)
        const result =  template(context, returnArrayOrValue);

        return result
    }

    static test(data){

        const engine = new TemplateEngine();

        return data.map(test => {

            const result = engine.render(test.template, test.context);

            const expected= test.expected ?? ""

            return {
                test,
                result,
                expect:test.expected,
                passed: result.replaceAll(/\s+/g, "") === expected.replaceAll(/\s+/g, ""),
            }

        });

    }

    analizeUntil( reqOrString, source, ){


        let match = source.match(reqOrString);
        if(!match) return [false, source.length]
        let keep = true
        let nextIndex = -1
        let s = ""
        let max = source.length
        let stack = 0

        // const openStack = []
        // const closeStack = []
        // const openStack = source.match(/{{/g)
        // const closeStack = source.match(/}}/g)
       
        // asd  {{  {{   }}  }}
        let currentIndex;
        while(keep){
            const char = source[nextIndex];
            const prev = source[nextIndex-1];
            const next = source[nextIndex+1];
            currentIndex = nextIndex;
           
            nextIndex++


            //save state of openening and closing brackets
            if(char == "}" && prev !== "\\"   && next == "}" )  {
                
                //escaped block
                if(source[currentIndex+2] == "}")  nextIndex += 2
                else nextIndex += 1

                stack--;
            }
    
            //if there is match and process brackets is closed, that's the point
            if(match.index == currentIndex){
                //everything is closed
                if(stack == 0) {
                    keep = false
                    break;
                }
                //try from new position later
                else{
                   
                    // const offset = match[0].length
                    const offset = 1 //increment only by one
                    const newMatch = source.slice(currentIndex).match(reqOrString);

                    if(!newMatch) {
                        console.log(currentIndex, reqOrString)
                        console.log("thesource.:::",source)
                        console.log("ss", s)
                        debugger
                    }
                    newMatch.index = match.index + offset + newMatch.index
                    match = newMatch
                }
       
            }

            if(char == "{" && prev !== "\\"  && next == "{" )  {

                //escaped block
                if(source[currentIndex+2] == "}")  nextIndex += 2
                else nextIndex += 1

                stack++
            
            }
        
            //end
            if(currentIndex == max){  
                keep = false 
             }

            s += source.slice(currentIndex, nextIndex);
          
        }

        if(stack !== 0){

            debugger
            throw new Error("Bracket not closed ")
        }
        return [s, currentIndex]

    }
    //spliting is much faster...
    //but this way  maybe is more easy to understand and probably more debuggable too
    //once parsed the speed would be the same, so we can save parsed on server
       
    parseExpression(source, process){

        const rest = source
        //start expression

         const startPos = 2;
         let first = source[startPos];
         let second = source[startPos+1];

         const isBlock = first == "#" || second == "#";
         const isClose = first == "/" || second == "/";
          const isHelper = first == "@" || second == "@"
        
         //END block
         if(isClose){
             //set index till the end of the block    
             const end =  rest.indexOf("}}") + 2
             process.stack.pop()

             return source.slice(end)
         }

        
         //add expression
         process.totalExpressions++

         //parse name
         //space from the begginging and not passing the closing brackets
         const spaced = rest.match(/^([^}]+?)\s+/)
         let endName;
 
         if(spaced){
            //spaced
            endName = spaced[0].length-1
         }else{
            // use analizeUntil in case is nested like {{some_{{meta@wp}}@wp}}
            const [_, end] = this.analizeUntil(/}}/, source)
            endName = end
         }

         
         const namePos = [startPos, endName];
         let name = source.slice(...namePos )

         if(first == "{" && name.includes("toJSO")){
            debugger
         }
         //remove first  not allowed "{@some" to "some" for clean name
         //also allow open parenthesis for nested expressions
         name = name.replace(/^[^a-zA-Z0-9(]{0,2}/, "")


         if(name.includes("(")){
            name = name.replaceAll(/\(|\)/, (m)=>m == "("?"{{":"}}")
         }

         if(name.includes("{{")){
            debugger
            name = this.parse(name, process)
         }


         
         const argsList = {
             type:"argumentList",
             list:[],
             hash:{},
         }

         const subType = process.currentExpression.type == "argumentList"?"sub":(isBlock?"block":"inline")
         const newExp = {
             name,
             first,
             second,
             forceHelper:isHelper,
             args:argsList,
             type:subType,
             isExpression:true,
         } 

         if(this.filterExpression){
            this.filterExpression(newExp, process)
         }

         if(newExp.type == "block"){
            newExp.content = []
         }

         const currentExpression = process.currentExpression
         //push expression
          process.stack.push(newExp)

          if(newExp.type == "sub"){
                currentExpression.list.push(newExp)
          }else{
            process.currentExpression.content.push(newExp)
          }
        
         //custom push
         process.stack.push(argsList)

         return source.slice(namePos[1])
      

    }
    parseArgument(source, process){


        let char = source[0]
        let rest = source

        const parentExp = process.stack.at(-2)

        if(this.filterArguments){
           const check =  this.filterArguments(parentExp,source, process )
           if(check !== undefined){

            if(!parentExp.args.list) parentExp.args.list = []
            if(!parentExp.args.hash) parentExp.args.hash = {}

             return check
           }
        }

          //close arguments
          if(char == "}" && source[1] == "}" && source[2] !== "}"){

            let end = 2;

            //if has triple
            if(parentExp.first == "{" && source[2] == "}") {
                end++
            }

            //close arguments list
            process.stack.pop()
            process.currentExpression = process.stack.at(-1)

            //close non block expressins (sub and inline)
            if(parentExp.type !== "block"){
                process.stack.pop()
            }

            return source.slice(end) ;

        
        }

        // const helper = this.getHelper(parentExp.name)
        
        if(parentExp.helper){

            debugger
        }  
        if(!rest.match)debugger
        const named = rest.match(/^([a-zA-Z]\S+?)=(?=.)/)

        let value , name, newSource;
        //named
        if(named){  
            const [_, n, quote] = named
    
            name = n
            source = rest = rest.slice(named[0].length)
            char = rest[0]
        }
        
        //string argument
        if(char == "'" || char == '"'){

            //match non escaped char " asdasom invalid\'  valid' "

        
            const reg = `([^\\\\]${char})( |}})`
            const match = rest.match(new RegExp(reg))

            if(!match) process.error()

            const end = match.index + 2

            
            const val = source.slice(0, end).slice(1,-1)
            if(val.includes("{{")){
                value = this.parse(val, process)
            }else{
                value = {
                    type:"string",
                    value:val
                }
            }

            // debugger
            // if(source.slice(0, 4) == "'{}'"){
            //     debugger
            // }
           

            newSource = source.slice(end)



        }
        //getter argument
        else if(char != " " && char !== "(") {
        
            const match = rest.match(/( |}})/);

            if(!match){
                debugger
                throw new Error("Broken argument at " + i + " in " + source.slice(-10, +10));

            }

            const end =  match.index

            value = {
                type:"getter",
                value:source.slice(0, end).split(".")
            }

            newSource = source.slice(end)


        }
        //subexpression
        else if(char == "(") {

                let [v, end] = this.analizeUntil(/\) /, source)

                if(!v) debugger
                v = v + ")"
                v = v.replaceAll(/\(|\)/g, ( s)=>{
                    return s == "(" ? "{{" : "}}"
                })

                const exp = this.parse(v, process)

                value = exp                

                newSource = source.slice(end+1)

        }

        if(value) {

            if(name){
                process.currentExpression.hash[name] = value
            }else{
                process.currentExpression.list.push(value)
            }
            
            return newSource
        }

        //move to next character
        if(char == " "){
            return source.slice(1);
        }


        return source.slice(1)

        // process.error()
    }
    parseContent(char, i, source, process){
        const rest = source.slice(i)
        // const match = rest.match("{{") ;
        const [value, end] = this.analizeUntil("{{", source)

        if(!process.currentExpression?.type ){
            debugger
        }
        if(process.currentExpression.type == "argumentList" ){

            process.error()
            // throw new Error("Broken argument at " + i + " in " + source.slice(i-10, i+10))
        }
        if(!process.currentExpression){

            process.error()

            // throw new Error("Broken expression at " + i + " in " + source.slice(i-10, i+10))
            // this.error("Broken expression at " + i + " in " + source.slice(i-10, i+10))
         
            return true;
        }

        if(!process.currentExpression.content?.push){
            debugger
        }
        process.currentExpression.content.push( {
            type:"string",
            value:value,
            start:i,
            end ,
        })

        debugger

        return end
    }
    

    parse(source, parentProcess ){
        
  
        const ast = {
            type:"root",
            content:[],
            source,
        }
        const process = {
            stack:[ast],
            index:0,
            error:()=> this.error(process),
            currentExpression:ast,
            //this helps to know if a current oppening or close is correct
            // ex: {{js ()=>{Object.assign({}, {a:{some:"some"}}) }}}
            // closeCharStack will be 0, but openCharStack will be 1
            closeCharStack:0,
            push(exp, newIndex){
                
                this.currentExpression.content.push(exp)
                // exp.parent = this.currentExpression
                this.stack.push(exp)

                if(newIndex){
                   return newIndex
                }
                if(exp.end){
                   return  exp.end 
                }
               
            },
            source,
            debug:{},
            totalExpressions:0,
          
            // ...parentProcess,

            
        };


        const debug = process.debug

        let s = source

        const exptectedExpressions = s.match(/{{[^/]/g)?.length ?? 0

        if(!exptectedExpressions){
            console.log(source)
            throw new Error("No expressions found in " + source)
        }

        //  while(process.index < source.length ){
        let lastS 
        while( s ){
          
            if(s === lastS){
                
                s = s.slice(1)
                continue;
                console.log("the source::::",source)
                console.log("at::::", s)
                throw new Error("Infinite loop:", lastS)

            }
            lastS = s

            process.currentExpression = process.stack.at(-1)
            process.currentString = s   


            //opening
            if(s[0]== "{" && s[1] == "{"){

               
                s =  this.parseExpression(s, process)   
          
                continue;
            }

            if( process.currentExpression.type == "argumentList"){

                s = this.parseArgument(s, process)

                continue;

            }
            //default
             
            //the content
            if(s[0] == "}" && s[1] == "}" && s[2] !== "}") debugger

            const [val, end] = this.analizeUntil( /{{/, s)
     

            process.currentExpression.content.push( {
                type:"string",
                value:val=== false?s:val, //the value or the rest of the string
            })
            s = s.slice(end)


        }


        const totalExpressions = process.totalExpressions
        if(exptectedExpressions !== totalExpressions && this.debug){


            console.error(`Total exppected expressions ${exptectedExpressions} but got ${totalExpressions} in "${source}"`)
        }


        if(parentProcess){

            parentProcess.totalExpressions += totalExpressions
       
        }
        return ast;

    }

    clearTemplates(){
        this.templates.clear()
    }
  }
  

// // Example usage:
//  const engine = new TemplateEngine({debug:true});
//     engine.registerHelper("slot", function(options){

//         return options.content?options.content({}):"no content"

// })

// //   engine.parse("{{#name some '{some:{sada}}' (nested some) }} some content {{/name}}")
// // const engine = new TemplateEngine();
// const ctx = { props: { colors: { main: "#fff" } } };
// const result = engine.render("{{if props.colors.main '--swiper-theme-color: {{props.colors.main}};' }}", ctx);
// console.log(result);

// 
 export default TemplateEngine


/**
 * 
  s= document.createElement("script")
  s.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.8/handlebars.min.js")
  document.body.appendChild(s)
 */

