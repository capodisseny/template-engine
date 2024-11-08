

class Parser{


    
    constructor(options = {}){

        this.options = options
        this.filterArguments = options.filterArguments
        this.filterExpression = options.filterExpression
        this.filterContent = options.filterContent


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

                    if(!newMatch) debugger
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
            const [_, end] = this.analizeUntil(/}}/, source.slice(startPos))
            endName = end+startPos
         }

         
         const namePos = [startPos, endName];
         let name = source.slice(...namePos )

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
             args:[],
             hash:[],
         }

         const subType = process.currentExpression.type == "argumentList"?"sub":(isBlock?"block":"inline")
         const newExp = {
             name,
             first,
             second,
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

         //push expression
          process.stack.push(newExp)
          process.currentExpression.content.push(newExp)

         //custom push
         process.stack.push(argsList)

         return source.slice(namePos[1])
      

    }
    parseArgument(source, process){


        let char = source[0]
        let rest = source


        const parentExp = process.stack.at(-2)

        if(this.filterArguments){
           const check =  this.filterArguments(source, process)
           if(check !== undefined){
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

            value = {
                type:"string",
                value:source.slice(0, end)
            }

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
                process.currentExpression.args.push(value)
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
        const [value, end] = this.analizeUntil("{{", process)

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

        const exptectedExpressions = s.match(/{{[^/]/g).length

        //  while(process.index < source.length ){
        let lastS 
        while( s ){
          
            if(s === lastS){
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

            debugger

        }


        const totalExpressions = process.totalExpressions
        if(exptectedExpressions !== totalExpressions){

            throw new Error(`Total exppected expressions ${exptectedExpressions} but got ${totalExpressions} in "${source}"`)
        }


        if(parentProcess){

            debugger
            parentProcess.totalExpressions += totalExpressions
       
        }
        return ast;

    }


  }

const parser =   new Parser()

//  parser.parse("some_{{meta@wp}}@wp")
//  parser.parse("{{some_{{meta@wp}}@wp}}")
parser.parse("{{#if some }}some true{{else}} some default{{/if}}")

//  parser.parse("{{some caca}}")

//  parser.parse("{{some caca (exp some) '{json:{s}}'}}")
//  parser.parse("<{{props.tag}}  is='{{props.tag}}'  data-popup='{{parentNode.id}}' data-show-popup='{{props.showPopup}}'><div if='{{slots.bg}}' class='container_bg'>{{#slot bg}}{{/slot}}</div><div class='popup_close' data-toggle-popup>{{#slot close}} X {{/slot}}</div>{{#slot default}}  {{/slot}}</{{props.tag}}>")

// export default Parser;