<?php

require_once "class-template-engine.php";



$tests =    [
    [
        "string"=>'<component is="{{props.tag}}"  href="{{props.link}}">
            <slot name="before">
                <Icon if="{{props.icon.before}}"  name="icon" />
            </slot>
            <span>
			{{#props.text}}
				{{#slots}}
				{{/slots}}
			{{/props.text}}
                <slot >
                    {{props.text}}
                </slot>
            </span>
            <slot name="after">
                <Icon if="{{props.icon.after}}"  name="icon" />
            </slot>
        </component>',
        "context"=>[],
        "expected"=>'<component is="{{props.tag}}"  href="{{props.link}}">
            <slot name="before">
                <Icon if="{{props.icon.before}}"  name="icon" />
            </slot>
            <span>'
    ],


    [
        "name"=> "deep nested",
        "string"=>'aaaabbb
            {{asda.aasda {{asda.aads{{asda}}@asda}} }}macacas
            {{asda}}macacas
            {{#if some}}
                    asda
                {{#if}}
                    {{asdasd.asda}}
                    asdasdañlk
                    {{asda.aasda {{asda.aads@asda}} }}
                    asdasda
                    {{#if asda}}
                        asda
                
                    {{/if}}
                    
                    asdañklsda


                {{/if}}
                NOOOOOOT

                {{else}}

                    NOTTT SOME data
            {{/if}}

            {{#asda}}
                WHOWWW me

                {{else}}

                    default NOOOOT
            {{/asda}}
            ',
        "context"=>[],
    ],
    [
        "string"=>'
            {{#if some}}
                {{some}}
                other data
            {{else}}
                default data
            {{/if}}
        ',
        "context"=>[
            "some"=>"some data"
        ],  
        "expected"=>'
                some data
                other data
        ',
    ],
    [
        "string"=>"link",
        "context"=>[ ],
        "expected"=>'link'
    ],
    [
        "string"=>'
            <{{props.tag}}  is="{{props.tag}}"  data-popup="{{parentNode.id}}" data-show-popup="{{props.showPopup}}"> 
                <div if="{{slots.bg}}" class="container_bg"> 
                    {{#slot bg}} 
                         {{/slot}}
                </div>
            
            <div class="popup_close" data-toggle-popup >  

                {{#slot close}} 
                    X
                 {{/slot}}

            </div>
            <!-- {{#slots.default}}{{/slots.default}} -->
            {{#slot default}}  {{/slot}}
      
        </{{props.tag}}>

        ',
        "context"=>[
        
        ],
        "expected"=>''
    ],
    [
        "string"=>'{{{asda}}}',
        "context"=>[
        
        ],
        "expected"=>''
    ],


    [
        "string"=>'{{b.{{b.b}}}}',
        "context"=>[
                "b"=>[
                    "b"=>"c",
                    "c"=>"holaa"
                ]
        ],
        "expected"=>'holaa'
    ],
    [
        "string"=>'{{b.(b.b)}}',
        "context"=>[
                "b"=>[
                    "b"=>"c",
                    "c"=>"holaa"
                ]
        ],
        "expected"=>'holaa'
    ],
    [
        "string"=>'{{#each loop }} {{.}}{{/each}}',
        "context"=>[
            "loop"=>[5,4,3]
        ],
        "expected"=>'543'
    ],
    [
        "string"=>'',
        "context"=>[
        
        ],
        "expected"=>''
    ]




] ;


