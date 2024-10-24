<?php 

namespace Fronta;



define("ENGINE_RETURN_EMPTY", "ENGINE_RETURN_EMPTY");
define("ENGINE_IS_FIRST", "ENGINE_IS_FIRST");
define("ENGINE_IS_LAST", "ENGINE_IS_LAST");
define("ENGINE_NO_CARRY", "ENGINE_NO_CARRY");
define("ENGINE_STOP_CONTENT", "ENGINE_STOP_CONTENT");


//website builder scenarios
// {{some()@wp}}
// {{is_header()@wp}}
// {{is_header("asda", prop.from.ctx )@wp}}
// {{color.main ""}}



//Nested? I think this has no sense, arguments should be or string or dynamic values or other expriessions
//{{if props.colors.main --swiper-theme-color: {{props.colors.main}}; }} 
//this has sense
//{{#props.colors.main}} --swiper-theme-color: {{props.colors.main}}; {{/props.colors.main}}


//use of @
//actually in website buidler {{some.data@owner}} maybe has more sense to do {{owner some.data}}
//maybe I can use some.data@owner and treat is equal to {{owner some.data}}
//
//{{#props.colors.main}} --swiper-theme-color: @value; {{/props.colors.main}}

//GENERAL CONCEPTS
//{{some.data}} //get a value
//{{any arg1 "arg2"}} //call a function
//BUT
//give the possibility for the helper to parse the arguments
// example
// {{js isArray(a) ? : "yes" : "no"}} //allow the helper js to handle all tihs as an expression

//{{(dynamicFunction) arg1}} //dynamic function
//{{#some.data}} //block

//IMPORTANT: think a way to be compatible with js, so the same syntax can be used in both languages
//example conflicts:
// {{( a + b)}} -> could be evaulated as a subexpression in php and should skaped for later evaluation in js
//another think would be to prefix js with js: {{js ( a + b)}} or {{js: a + b}}
//IMPORTANT: if both renders are the same php and js, 
//the backend engine can send via script the js code to be evaluated in the client


//helpers without arguments
// {{}}

//ARGS
//could be //by default
//{{helper some.prop  another (helper2 some value) "string"}} // non quoted values by default are accessors or expressions
// {{asda_{{wp some.data}}@wp}}}
//or
//{{helper {{some.prop}} {{another}} 213 string  }} // 


//SYMBOLS
/**
 * 
 
 
    {{ # -> block
    {{ / -> close block
    {{  -> inline
    {{ { -> unescaped content
    {{ @ -> domain/helper
        in handlebars si used for special vars like @index, @key, @first, @last
        but i think has more sense to use it as domain, ownership of the expression
        so: {{some.data@owner}} is equal to {{owner some.data}}
        or: {{@someHelperNoArgs}} or {{someHelperNoArgs  }} //spaced

        //this can avoid conflicts with unintentioned accessors 
            //{{someHelper + 123 + "123" }} //accessor
            //{{@someHelper}} //helper

        {{ :  -> ?? could binding to new context?
        {{:some.items.0}}
            {{name}}
        {{/some.items.0}}

    {{ ( ->

    {{ ^ --> else 
    {{ & --> ?? unescaped
    {{ > --> partials
    {{ ! --> comment?? are comments necessary??
            with inline
                {{!some.prop}} //may render false?
            in blocks
                {{! some.prop}}
                    No property "some.prop" found
                {{/}}
    {{ $ -->variable ??
    {{ + 
    {{ -
    {{ %



 */



class TemplateEngine{

    private $helpers = [];
    private $templates = [];
    private $compilers = [];
    private $char = ["{", "}"];
    private $char2;
    private $char3;
    private $block = ["#", "/"];
    private $partial = ">";


    public function __construct(){

        $this->registerHelper("each",[
            "render"=>function($loop, $options){
      
   
                if(!is_array($loop)) return;

                $source = "";

                foreach($loop as $k=>$value ){

                    $v;
                    if(!$options["fn"] ?? false){
                        $v = $options["fn"]($value);
                    }
                    //block
                    else{
                        $v = $value;
                    }

                    $source .= $v;
                }
                return $source;
            }
        ]);
        

        $this->registerHelper("if",[
            "render"=>function($condition,$val, $defaultVal, $options){

                //if is inline return the second argument
                if(!($options["fn"] ?? false)){

                    if(!$condition) return $defaultVal || null;
                   
                    return $val;
                }
                //if is a block return the content
                else{

                    if(!$condition) return;
                    
                    return  $options["fn"]( $options["context"]);
                }
            
        
            }
        ]);


        $this->registerHelper("else", [
            
            "render"=>function($yes, $condition, $check, $val, $options){
               
                if($yes) return $options["stop"];
         

               //else if
                if($condition == "if" && !$check){
                    return ;
                }

                //default else
                if($options["fn"]) return  $options["fn"]($options["context"]);

                return $val;
                
            },
            "compiler"=>function($block, $parentBlock, $args){

                return array_merge($block, [
                    "type"=>"block",
                    "args"=>$parentBlock["args"],
                ]);
        
            }
        ]);

        $this->registerHelper("toJSON",function($json, $options){
        
            if(!($options["fn"] ?? false)){

                return json_encode($json);
            }

        });


        $this->registerHelper("js",
        
                [
                    "compileArgs"=>function($args){
                        return $args;
                    },  
                    "getArgs"=>function($args){
                        return $args;
                    },
                    "render"=>function($code){
                        static $ids = 0;

                        $id = "exp_".$id;
                        $this->jsExpressions = $this->jsExpressions ?? [];
                        $this->jsExpressions[$id] = $code;

                        $ids++;

                        return "{{js $id}}";
                    }
                ]
        );




        $this->char2 = array_map(function($char){
            return $char.$char;
        }, $this->char);

        $this->char3 = array_map(function($char){
            return $char.$char.$char;
        }, $this->char);
    }

    private function getArgs($exp, $args, $context){
    
        if($exp["getArgs"] ?? false) return $exp["getArgs"]($args, $context);


        if(!is_string($args) && is_callable($args)){

            $args = $args($context);
            $args = preg_split("/\s+/", trim($args));
        }

        $named = [];
        $orderedArgs = $args["ordered"] ?? [];
        $namedArgs = $args["named"] ?? [];
        
        foreach( $namedArgs as $name=>$arg){
            $value;
            if($arg == ".")  $value =  $context;
            else if(is_string($arg))  $value =  $arg;
            else $value = $this->get($arg, $context);
            $named[$name] = $value;
        }
       
        $ordered = array_map(function($arg) use($context){
            if($arg == ".") return $context;
            if(is_string($arg)) return $arg;
            return $this->get($arg, $context);
        }, $orderedArgs);
        
        
        return ["named"=>$named, "ordered"=>$ordered];
    }

    public function registerCompiler($id, $callback){

        $this->compilers[$id] = $callback;

    }
    private function getCompiler($helper){
        
        if($helper && is_array($helper)){
            return  $helper["compiler"] ?? false;
        }
    }
    public function registerHelper($id, $callbackOrOptions){

        if(is_callable($callbackOrOptions)){
            $callbackOrOptions = [
                "render"=>$callbackOrOptions
            ];
        }
        $this->helpers[$id] = $callbackOrOptions;

    }
    private function getHelper($id){
        
        return $this->helpers[$id] ?? false;
    }
    private function saveTemplate($string, $template){

        $id = md5($string);
        $fn = function($context = []) use ($template){
            return $this->renderPart($template, $context);
        };
        $this->templates[$id]  = $fn;

        return $fn;

    }
    private function getTemplate($string){

        $id = md5($string);

        return $this->templates[$id] ?? false; 

    }


    private $precompilers = [];
    private $precompilations = [];
    private $precompileId = 0;
    private function registerPrecompiler($expression, $callback){

        $this->precompilers[] = [
            "expression"=>$expression,
            "callback"=>$callback
        ];

    }

    private function runPrecompilation($id, $context){

        $precompiler  = $this->precompilations[$id];
        if(  $precompiler ){
            $callback = $precompiler["callback"];
            $args = $precompiler["args"];

            return $callback($context, ...$args );
        }
    }

    private function handlePrecompilation(){

            $precompiler = $this->precompilers[$this->precompileId];

            $callback = $precompiler["callback"];

            $args = func_get_args();

            $this->precompilations[$id] = [
                "callback"=>$callback,
                "args"=>$args
            ];

            $id = $this->precompileId++;

            //{{__pre__id}}
            return $this->char2[0]."__pre__".$id.$this->char2[1];
    }




    public function compile($str,  $run = false,  $context = [], $reducer = false){

        if(!$str) return $str;


        $exist = $this->getTemplate($str);
        
        if($exist ) {

            if($run) return $exist($context);

            return $exist ;
        }

        $originalStr = $str;

        if(!is_string($str)) die("template is not string");
        
        //html comments
        $reg = '/<!--.*{{.*-->/';
        $str = preg_replace($reg, '<!-- skiped -->', $str);

        //css comments
        $reg = '/\/\*.*{{.+}}.*\*\/';
        // $str = preg_replace($reg, '', $str);

        //trim    
        $str = trim( $str);
        

        //pre compilation
        if($this->precompilers){
            foreach($this->precompilers as $id => $precompiler){
                $reg = $precompiler["expression"];
                $this->precompileId = $id;
                $str = preg_replace_callback($reg,
                    $this->handlePrecompilation
                    //i think maybe i need to do this
                    //["handlerPrecompilation", $this]
                , $str);
                $str = $precompiler($str);
            }
        }



        $reg = "/((?:{{{|{{)(?:(?R)|.)+?(?:}}}|}}))/";
        $split = preg_split($reg, $str,  -1, PREG_SPLIT_NO_EMPTY | PREG_SPLIT_DELIM_CAPTURE);

        $length = count($split) - 1;

        $result = $this->returnArrayOrValue ? []:"";
        $template = [
            "main"=>true,
            "source"=>$originalStr,
            "content"=>[]
        ];

        //unset to avoid overrite other tempalates
        unset($this->currentTemplate );

        $this->currentTemplate = &$template;

        //stack
        $blockStack = [ &$template ];
        $this->blockStack = &$blockStack ;

        foreach($split as $part){

        
            //unset the refenences
            unset($content);  

            $content = &$this->processExpression($part );
            
            $openNewBlock  = $content["close"] ?? false;
            //RENDER    
         
            if($run ){

   
                $render = false;
           
                die("ñlaskdasñl");
                //get last block
                if(count($blockStack) == 2 && $openNewBlock ){
                    $render = $blockStack[count($blockStack)-1];
                }   
                //in current stack render all unless is an open block
                if(count($blockStack) == 1 && ($content["type"] ?? false) !== "block"){
                    $render = $content;
                }
                if($render ){

                   $value =  $this->renderPart($render , $context);

                   $result = $this->joinValue($result, $value);
               
                }

                
            }


          
            
            //remove old block from stack
            if( $openNewBlock ){
                array_pop($blockStack);
            }


            //skip close block
            if(isset($content["type"]) && $content["type"] === "closeBlock") continue;

         
            //get last block
            if(!empty($blockStack)){			
                //by reference
                $currentBlock = &$blockStack[count($blockStack)-1];		

                if($currentBlock == $content){

                    dump($blockStack, $content);
                
                    die("Recursion");
                }

                $currentBlock["content"][] = &$content;	

                unset($currentBlock );
            }else{

                dump($blockStack, $content);

                die("Broken block, check string for unclosed blocks");

            }

            //push Content
            if(is_array($content) && $content["type"] == "block"){

                $blockStack[] = &$content;

            }
            
                

         

        }


        unset( $this->blockStack, $blockStack);



        $r = $this->saveTemplate($originalStr, $template);


        if($run) {

            // return $r($context);
            return $this->filterValue($result, true);
 
        }


        return $r;

            
    }

    private function &processExpression($part){


        $char = $this->char;
        $char2 = $this->char2;


        $isExpression = substr($part, 0, 2) == $char2[0];
            
        if(!$isExpression) return $part;

        
        $content = false;
        $openBlock = false;
        $currentBlock = false;

        $closeBlock = false;


        $part = trim($part);
        $part = trim(substr($part, 2, -2));

        //expresion definition {{[.]....}}
        //  $definitions = [
        //     ""=>["type"=>"inline"],
        //     "{"=>[],
        //     "@"=>["type"=>"helper"],
        //     // ":"=>["type"=>"context"],
        //     // "^"=>["type"=>"else"],
        //     // "&"=>["type"=>"unescaped"],
        //     // ">"=>["type"=>"partial"],
        //     // "!"=>["type"=>"comment"],
        //     // "$"=>["type"=>"variable"],
        //     "("=>["type"=>"nested"],

        // ];

        // $first = substr($part,0, 1);

        // $definition = false;
        // if(isset($definitions[$first])){
        //     $part = substr($part, strlen($first), -1);
        //     $definition = $definitions[$first];
        // }

        //Check first character
        $first =  substr($part,0, 1);

        //escaped
        $triple = $first == $char[0];
        if($triple) {
            $part = substr($part, 1, -1);
            $first = substr($part,0, 1);
        }


        //then block or inline
        $openBlock = $first  == $this->block[0];
        $closeBlock = $first == $this->block[1];	
        $isInline  = false;

        if(!$openBlock && !$closeBlock)  $isInline = true;

        $isPrecompiled = substr($part, 0, 7) == "__pre__";

        $isEnd = $closeBlock;



     
        if(isset($newContent ) ) unset(  $newContent );
        // $newContent = [];
        $content = [
            "part"=>$part,
            "type"=>$isInline?"inline":"block",
            "triple"=>$triple,
            "close"=>$isEnd,
            // "content"=>&$newContent,
        ];
        // unset(  $newContent );

        if( $isPrecompiled ){
            $content["precompiled"] = substr($part, 7, -1);
        }

        if($closeBlock) $content["type"] = "closeBlock";


        if(!$closeBlock ){

            //remove the block character
            if($openBlock )	$part = substr($part, 1);

         

            //new first can be the definer (@, >, ...)
            $first = substr($part, 0, 1);
            
            //if is not letter
            if(!preg_match("/^[.a-z0-9$]/i", $first)){
               $part = substr($part, 1);
            }

            //[ match, name, args]
            $s =[];
            preg_match("/(\S+)\s*(.+)?/", $part, $s);

            $isNamed = $s[2] ?? false;
            $name = $isNamed ? $s[1]:false;
            $args = $isNamed ? $s[2] : $s[1];

            //is helper {{@someId}}
            if(!$name && $first == "@"){
                $name = $args;
            }
            //equivalent to {{name argss}} or {{@name argss}}
            if(!$name && strpos($args, "@")){
                $s = [];
                preg_match("/(.+)@(.+?)$/", $args, $s);
                $name = $s[2];
                $args = $s[1];

                dump($name, $args, $part);
                die("its ok???");
            }




            // if($part == "." || $name == "." || $args == "."){
            //     dump($part, $name, $args, $s);
            //     die("lakskjdsakjlsdlk");
            // }
           

            //HELPER    
            $was = $content["type"];
            $old = &$content;
            $content = &$this->setupHelper($name, $content, $args);

         
            $content["name"] = $name;


            // if($name == "toJSON"){

            //     dump($content);

            //     dump($content["helperFn"](array("asdads"), []));

            //     die("laksdjalk");
            // }
       
            // $content = &$v;
            if($was == "inline" && $content["type"] == "block") {
                $content["close"] = true;
            }

            //open block
            if($content["type"] == "block"){


                // if(isset($content["content"])){
                //     die("alkjsdjklads");
                // }

                // unset($newContent );
                // $newContent = ["hola"];
                $content["content"] = [] ; 

              
            }

            //parse arguments
            if(!isset($content["args"])){

                if(strpos($args, "(") !== false){
                    $args = preg_replace_callback("/\)|\(/", function($m) {
                        return $m == "("? "{{": "}}";
                    }, $args);
                    $content["args"] = $this->compile($args);
                }else{
                    $content["args"] = $this->parseArguments($args, $content);
                }              
              
            }

            
        }

        
        return $content;

        
    }
    private function parseArguments($args, &$content){
        $args = preg_split("/\s+/", trim($args));

        $expArgs = [
            "named"=>[],
            "ordered"=>array_fill(0,  ($content["numberArgs"]  ?? 1) -1 , null)
        ];

        $index = 0;
        foreach($args as $arg ){

            $name = false;

            if(strpos($arg, "=")){
                $s = [];
                preg_match("/(.+?)=(.+)/", $arg, $s);
                $name = $s[1];
                $arg = $s[2];
            }
            
            if(substr($arg, 0, 1) == '"' || substr($arg, 0, 1) == "'") $arg = substr($arg, 1, -1);
            else $arg = explode(".", $arg);

            if($name){
                $expArgs["named"][$name] = $arg;
                continue;
            }
            //
            $expArgs["ordered"][$index] = $arg;
            $index++;
        }

        return  $expArgs;
    }

    //set the return by reference
    private function &setupHelper($name , &$content, $args){


        $helper = false;


        //cheeck if is a string, could be a nested part
        if($name && is_string($name)) $helper =  $this->getHelper($name);
        if(!$helper && $args && is_string($args)) $helper =  $this->getHelper($args);
    


        //skip not found helpers
        if($name && !$helper){  
        
            trigger_error("Helper not found: '$name'//" );
            die("Helper not found");
        }

        if(!$helper) return $content;


        $compiler = $this->getCompiler($helper);

        //custom compilation
        if($compiler){
            $blockStack = &$this->blockStack;
            $parent = $blockStack[count($blockStack)-1];
            $content = $compiler($content, $parent, $args);
        }
        
         
        //render function
        if($content["type"] == "block"){
            $content["render"] = function($context) use ( &$content){
        
                return $this->renderContent( $content, $context);
            }; 
        }

        //get value function
        // $content["getValue"] = function($context = false) use(&$args){
        //     return $this->get($args, $context);
        // };


        $helperRender =  $helper["render"] ?? false;
      
        $content["helperFn"] =  $helperRender;

        if($helperRender && is_callable($helperRender)){

            $reflection = new \ReflectionFunction($helperRender);
                // echo $reflection->getNumberOfParameters();      // Output: 3
                // echo $reflection->getNumberOfRequiredParameters(); // Output: 2
            $content["numberArgs"] = $reflection->getNumberOfParameters();   
        }

        //compileArgs
        if(is_array($helper) && isset($helper["compileArgs"])){

            $content["args"] = $helper["compileArgs"]($args);
        }

        //filterArgs
        if(is_array($helper) && isset($helper["filterArgs"])){

            $content["filterArgs"] = $helper["filterArgs"];
        }

        //validateContent
        if(is_array($helper) && isset($helper["validateContent"])){

            $content["validateContent"] = $helper["validateContent"];
        }

        return $content;
    }

    private function joinValue($carry, $value){

            
        if(is_array($carry)){
            $carry[]= $value;
        }else{
            $carry .= $value;
        }

        return $carry;

    }
    private function filterValue( $value , $last = false){
        
        $returnVal = $this->returnArrayOrValue;

        if($last){
            if(is_array($value) && count($value) == 1){
                return $value[0];
            }
            
            return $value;
        }

        if(ENGINE_RETURN_EMPTY === $value) {
            if($returnVal) return;
            return "";
        }
        
        //FILTER VALUE
        if(!$returnVal){

            if(!is_string($value)){

                if(is_callable($value)){
                    dump($part);
                    die("Value by default is not callable, use a Helper");
                    $value = $value($context);
                }
                if(is_array($value)){
                    $value = "[ARRAY]";
                }
                if(is_object($value)){
                    $value = "[Object]";
                }
                
                $value = strval($value);
            }
        }
    
        return $value;

    }
    private function renderPart($exp, $context){

        //a normal string
        if(is_string($exp)) return $exp;


        if(!is_array($exp)){   
            // dump($this->currentTemplate);
            dump($exp);
            dump(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS));
            dump($exp);
            die("asda");
            
         }

        $args = $exp["args"] ?? [];
        $name = $exp["name"] ?? false;
        $isMain = $exp["main"] ?? false;
        $precompiled = $exp["precompiled"] ?? false;
        $type = $exp["type"] ?? false;



        $parsedArgs = $this->getArgs($exp, $args, $context);

    
        if(!is_string($name) && is_callable($name)){
            //Rething that, because if is a dynamic name can not be compiled 
            //so here we would loose speed
            die("Rething dynamic names {{{{som.name}} some args}}");
            $name = $name($context);
        }


        //INIT VALUE
        $value;

        //inline
        if(!isset($exp["helperFn"]) && $type == "inline"){

            $value =  $parsedArgs["ordered"][0] ?? null;

        }
        //processed helpers
        else if($isMain){
            unset($this->currentTemplate );
            $this->currentTemplate = $exp;

            $value = $this->renderContent($exp, $context);
        }
        //precompiled
        else if($precompiled){
            $value = $this->runPrecompilation($precompiled, $context);
        }
        //helper functions
        else if($exp["helperFn"] ?? false){

            //TODO: change what params pass or think how to have it more clear inside the helper fucntion
            // new you can check $exp["type"] to know if is dynamic or is a block
            if(!is_array($parsedArgs))$parsedArgs = [$parsedArgs];

            $ordered = $parsedArgs["ordered"] ?? [];
            $named = $parsedArgs["named"] ?? [];

    
            // \Closure::bind( $template, $this)($context->props ?? false , $context);
            $value = call_user_func_array($exp["helperFn"],  [...$ordered , ["fn"=>$exp["render"] ?? false,"context"=>$context, "args"=>$named ] ]  );

        }
        //default behavour
        else{

            //return empty
            if(!$this->validateContent($exp, $parsedArgs)){ 
                return ENGINE_RETURN_EMPTY;
            }
            //return the content
            else $value = $this->renderContent($exp, $context);
        }
        return $this->filterValue($value);

    }
    private function validateContent($exp , $parsedArgs){

        if($exp["validateContent"] ?? false){
            return $exp["validateContent"]($parsedArgs, $exp);
        }

        return   $parsedArgs["ordered"][0] ?? false;


    }
    private function get($path, $context){

        $steps =  is_array($path)? $path : $path.split('.');

        $value = $context;
        $i = -1;
        $last = count($steps)-1 ;
        while ($i < $last) {
            $i++;
            // const last = index === paths.length - 1;
            if(!$value) return;

            if(is_object($value)){
                $key = $steps[$i] ?? null;
                $value = $value->$key ?? null;
            }else{
                $value = $value[$steps[$i]] ?? null;
            }
          
        }
        return $value;
    }
    private function renderContent( $part, $context){


       
        // $result = $this->reducer(ENGINE_IS_FIRST);
        $result = $this->returnArrayOrValue ? []:"";

        $content = $part["content"];

        if(empty($content)) return "empty";

        foreach($content as $c){

            $value = $this->renderPart($c, $context);


            // if($c["part"] == "."){

            //     die("lñkjadsjkladskj");
            // }
            // if($context == 54){

            //     die("ñlasdjlaksda");
            // }

            if($value === ENGINE_RETURN_EMPTY) continue;

            $result = $this->joinValue($result, $value);

        }

        return $this->filterValue($result, true);

    }

    private  $returnArrayOrValue = false;

    public function render($str_or_arr, $context = [], $returnArrayOrValue = false){


        if(!is_string($str_or_arr)) return $str_or_arr;
        
        if(!$str_or_arr) return $str_or_arr;
        
        $this->returnArrayOrValue =  $returnArrayOrValue;

        // $result = $this->compile($str_or_arr, true, $context);
        $template = $this->compile($str_or_arr);
        return  $template($context);

        $this->returnArrayOrValue = false;

        return $result;


    }


}




 

 //IMPORTANT: php will nver allow a reference from a function
//  $fn = function (&$s) {
//     return $s;  // The function still returns by value, reference will be lost
// };

// $v = &$fn($old);  // Now $v is a reference to $old
// $v["content"][] = "another";  // Modifies $old and $arr

// var_dump($v == $old);  // true (values are the same)
// var_dump($v === $old); // true (they are referencing the same memory)

//  die();

//RETURN By REFERNCE
//  $fn = function &(&$s) {
//     $s["asdas"] ="maracoo";
//     return $s;  // The function still returns by value, reference will be lost
// };

// $arr= [];

// $old = &$arr; 
// $v = &$fn($old);  // Now $v is a reference to $old
// $v["content"][] = "another";  // Modifies $old and $arr

// var_dump($v , $old);  // true (values are the same)
// var_dump($v === $old); // true (they are referencing the same memory)

//  die();
// $engine = new TemplateEngine();
// $ctx = ["props"=>["colors"=>["main"=>"#fff"]]];
// // $d = $engine->compile("{{if props.colors.main --swiper-theme-color: {{props.colors.main}}; }}" );
// $d = $engine->render("{{#each loop }} {{.}}{{/each}}", ["loop"=>[54,53,2]]  );
// $d = $engine->render("{{#each loop }} {{.}}{{/each}}", ["loop"=>[54,53,2]]  );

// // dump($d);
// // $d = $engine->render("{{if props.colors.main --swiper-theme-color: {{props.colors.main}}; }}" );
// // dump("asd");
// // dump($d($ctx) );
// die("asdasda");


