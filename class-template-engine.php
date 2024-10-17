<?php
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

		$this->registerHelper("else",function($tag, $context, $render, $getValue){

			if($getValue($context)) return "";

			return  $render($context);

		});

		$this->registerCompiler("else",function($parentBlock, $tag){
			
			return  array(
				"type"=>"block",
				"name"=>"else",
				"new"=>true,
				"tag"=>$parentBlock["tag"],

			);

		});



		$this->char2 = array_map(function($char){
			return $char.$char;
		}, $this->char);

		$this->char3 = array_map(function($char){
			return $char.$char.$char;
		}, $this->char);
	}
	
	public function registerCompiler($id, $callback){

		$this->compilers[$id] = $callback;

	}
	private function getCompiler($id){
		
		return $this->compilers[$id] ?? false;
	}
	public function registerHelper($id, $callback){

		$this->helpers[$id] = $callback;

	}
	private function getHelper($id){
		
		return $this->helpers[$id] ?? false;
	}
	private function saveTemplate($string, $template){

		$id = md5($string);
		$fn = function($context) use ($template){
			return $this->renderPart($template, $context);
		};
		$this->templates[$id]  = $fn;

		return $fn;

	}
	private function getTemplate($string){

		$id = md5($string);

		return $this->templates[$id] ?? false; 

	}
	


	public function compile($str,  $run = false,  $context = []){

		$exist = $this->getTemplate($str);

		if($exist ) {

			if($run) return $exist($context);

			return $exist ;
		}

		$originalStr = $str;

		if(!is_string($str)) die("template is not string");
		
		$reg = '/<!--.*{{.*-->/';
		$str = preg_replace($reg, '<!-- skiped -->', $str);
		
		//{{((?R)|.)+?}}
		$split = preg_split("/({{(?:(?R)|.)+?}})/", $str,  -1, PREG_SPLIT_NO_EMPTY | PREG_SPLIT_DELIM_CAPTURE);
	
		$length = count($split) - 1;



		$result = "";
		$template = [
			"main"=>true,
			"source"=>$originalStr,
			"content"=>[]
		];

		unset($this->currentTemplate );
		$this->currentTemplate = &$template;
		//stack
		$blockStack = [ &$template ];

	

		$char = $this->char;
		$char2 = $this->char2 ;
		$char3 = $this->char3;
		$char3end = $char3[1];
		
		foreach($split as $part){

		
			$isDynamic = substr($part, 0, 2) == $char2[0];
			
	
			$customBlock = false;
			$content = false;
			$openBlock = false;
			$currentBlock = false;
	
			$closeBlock = false;
			// $isBlock = false;
			if($isDynamic){


				$part = trim($part);

				if($isDynamic) $part = trim(substr($part, 2, -2));
		
				$triple = substr($part,0, 1) == $char[0] &&  substr($part,0, 2) !== $char2[0];//ensure is not a dynamic block
		
				$endTag = $triple ? $char3end : $char2[1];
		
				$nChars = strlen($endTag);
		
				if($triple) $part = substr($part, 1);
		
				$openBlock = substr($part,0, 1) == $this->block[0];
			
				$closeBlock = substr($part,0, 1) == $this->block[1];	

				// $isBlock = $openBlock || $closeBlock;
				// if(	$closeBlock )dump("LKAJSLKJDSKJDKLJ::".$closeBlock);
			
				if(!$closeBlock ){

					
					//remove the block character
					if($openBlock )	$part = substr($part, 1);


					$tag = $part;

					$s = preg_split("/\s+/", $part, 2);
					

					$isNamed = $s[1] ?? false;
					$name = $isNamed ? $s[0]:"";
					$tag = $isNamed ? $s[1] : $s[0];

					if($openBlock ){
						$name = $s[0];
						$tag = $s[1];

					}
			

					if(!is_string($tag)){
						// dump($s);
						// dump($tag);
						// die("alksdjalsda");
					}

					$compiler = false;
				
					if($name) $compiler =   $this->getCompiler($name);
					if(!$compiler && $tag) $compiler =  $this->getCompiler($tag);


					//custom compilation
					if($compiler){
					
						$parent = $blockStack[count($blockStack)-1];
						$customBlock  = $compiler($parent, $tag);
			
						if(isset($customBlock["type"])){
							$openBlock = $customBlock["type"] == "block";
							
						}

					}
			

					//dyanmic name
					//{{{{dynamic.name}} some.prop}}
					if(strpos($name, $char2[0]) > -1){

						die("Not implemented");
						//compile nested
						$name = $this->compile($name);

					}

					//dyanmic tag
					//{{{{dynamic.tag}}}} || {{name  {{dynimic.tag}}}}
					if(strpos($tag, $char2[0]) > -1){
						//compile nested
						$tag = $this->compile($tag);

					}


					if(!is_string($tag)){
						// dump($s);
						// dump($tag);
						// die("alksdjalsda");
					}
					
					
					$content = [
						"type"=>$openBlock?"block":"dynamic",
						"tag"=>$tag,
						"name"=>$name,	
						"triple"=>$triple,
						"part"=> $part,
						// "source"=> $str,
						
					];

					//custom block
					if($customBlock){
						$content = array_merge($content, $customBlock);				
					}
					

					//open block
					if($openBlock){
						$content["content"] = []; 
					}

					//HELPER
					$helper = false;
					if($name) $helper =  $this->getHelper($name);
					if(!$helper && $tag) $helper =  $this->getHelper($tag);
			
					if($helper){
						$content["render"] = function($context) use( &$content){
							return $this->renderContent($content, $context);
						}; 

						$content["getValue"] = function($context = false) use($tag){
							return $this->get($tag, $context);
						};

						$content["helperFn"] = $helper;
			
					}
				}
		
			
				
			}else{

				$content = $part;
			}

			
			//RENDER
		
		
			if($run){


				//before closing a block
				if($closeBlock && count($blockStack) == 2){
					$result .= $this->renderPart($blockStack[count($blockStack)-1], $context);
				}

				//on first level
				if(count($blockStack) == 1){

					if($isDynamic ){
			
						if($content["type"] == "dynamic"){
							$result .= $this->renderPart($content, $context);
						}
						//new block is going to be created, so just run the block above
						else if(isset($customBlock["new"])){
	
	
							$result .= $this->renderPart($blockStack[count($blockStack)-1], $context);
	
						}
						
					}
					//content and is main content
					if(!$isDynamic ){
	
						if(!$content){
							dump($split);
							dump($str);
							die("ñlasdakjsd");
						}
						$result .= $content;
					}

				}

				
			
				

		
				
			}

			

			//append to parent
			if($customBlock && $customBlock["new"]){
				array_pop($blockStack);

			}

			//get last block
			if(!empty($blockStack)){			
				//by reference
				$currentBlock = &$blockStack[count($blockStack)-1];				
			}else{

				dump($blockStack, $content);

				die("Broken block, check string for unclosed blocks");
		
			}


			//push Content
			if($openBlock){

				 $blockStack[] = &$content;

			}

			if($content){

				if($currentBlock == $content){
			
					die("Recursion");
				}

			

				 $currentBlock["content"][] = &$content;

			}
			
			
			//close block
			if( $closeBlock){

				array_pop($blockStack);	
			}

			//unset the refenences
			unset($content);
			unset($customBlock);
			unset($currentBlock );
		


		}



		$r = $this->saveTemplate($originalStr, $template);


		if($run) {

			// return $r($context);
			return $result;
		}


		return $template;
	
			
	}
	

	private function renderPart($part, $context){

		//a normal string
		if(is_string($part)) return $part;

		$this->currentPart = $part;

		$tag = $part["tag"] ?? "";
		$name = $part["name"] ?? false;
		$isMain = $part["main"] ?? false;

		if($isMain){
			unset($this->currentTemplate );
			$this->currentTemplate = $part;
		}



		$value;
		//processed helpers
		if($isMain){
			$value = $this->renderContent($part, $context);
		}
		else if($part["helperFn"] ?? false){

			$value = call_user_func($part["helperFn"], $tag, $context, $part["render"], $part["getValue"], $part, $this->currentTemplate);

		}else{

			$tag = $part["tag"];
		
			if(is_array($tag)){
				$newTag = "";
				foreach($tag as $t){
					$newTag .= $this->renderPart($t, $context);
				}
				$tag = $newTag;
			}

			$type = $part["type"];

			
			if($type == "dynamic"){
				//filter 

				//default
				$value =  Instance::getProp($tag, $context);
			}else{

				$value = $this->get($tag, $context);

				//return empty
				if(!$value) $value = "";
				//return the content
				else $value = $this->renderContent($part, $context);
			}
			
		}	

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
		

		return $value;


	}
	private function get($tag, $context){

		if(!$tag) return;
		if(!is_string($tag)) {

			dump(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS));
			var_dump($tag);
			die("Path is not a string");
		}

		return Instance::getProp($tag, $context);
	}
	private function renderContent($part, $context){

		$result = "";
		$content = $part["content"];

		if(empty($content)) return "";

		

		foreach($content as $c){

			if(!$c){
				dump($part);
				die("asdasda");
			}

			$result .= $this->renderPart($c, $context);
		}
	
		return $result;
	}
	
	public function render($str_or_arr, $context = [] ){


		$result = $this->compile($str_or_arr, true, $context );
		


		return $result;


	}


}
