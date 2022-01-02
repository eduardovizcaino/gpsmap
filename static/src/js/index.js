globalThis.object_gpsmap;

odoo.define('gpsmap', function (require) {
    "use strict";
    var AbstractAction  		=require('web.AbstractAction');
    var core            		=require('web.core');
    var session         		=require('web.session');
    var Widget          		=require('web.Widget');
    var rpc             		=require('web.rpc'); 
            
    var local                   ={};
    var localizaciones			=new Array();    
    var labels					=new Array();
    var vehicle_data			=new Array();
//    var locationsMarker 		=new Array();
    var localizacion_anterior;
//	object_gpsmap;    
    var coordinate_active		=undefined;
    var simulation_action		="stop";
    var isimulacion				=1;
    var simulation_stop			=0;
    var simulation_time			=100;
    var geofence;
    
    //////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////    

    var class_gpsmap = AbstractAction.extend({
    	
        willStart: function () {
            //console.log("class_gpsmap.willStart");
            this.locationsMarker 		=new Array();              
			this.GeoMarker				=Array();
			this.GeoMarker1				=Array();
			this.lineas					=Array();	
			this.Polyline				=undefined;
			this.time					=0;            
            this.map;            
            this.device_active=0;
                        
            
            var data={
                method: 'search_read',
                context: session.user_context,
            };
            self = this;
                        
            data["model"]="fleet.vehicle";            
            var def= this._rpc(data)
            .then(function(res) 
            {
                local.vehicles     =res;                                        
                self.vehicles_menu();      
            });
                    
            return this._super.apply(this, arguments);
        },        
        /*
        datas_rpc: function(data, model)
        {	    	
            data["model"]=model;
            return this._rpc(data).then(function(res)   {  
                console.log("########### DATAS ############### "+ model);
                console.log(res);
                return res;                
            });
        },
        */        
        ////////////////////////////////////////////////

        events: {
            'click div.vehicle': function (e) {                
                //console.log("class_gpsmap.events");
                var objeto=e.currentTarget.attributes;
                $("div.vehicle").removeClass("vehicle_active");                
                this.device_active=objeto.vehicle.value;               
                $("[vehicle='" + this.device_active + "']").addClass("vehicle_active");                
                    
                if(this.gpsmap_section=="gpsmaps_maphistory")
                {
                    this.status_device();                    
                }
                else
                {
                    this.status_device($("[vehicle='" + this.device_active + "']"));                                
                }
                //self = this;
            },
            'click button#action_play': function (e) {
	            if(local.positions.length>0)
		        {
		            simulation_action="play";
		            this.del_locations();
		            //self = this;            
		            $("div#odometro").show();
			        this.paint_history(isimulacion);
		        } 			       					
            },
            
            'click button#action_search': function (e) {
            	this.gpsmap_section="gpsmaps_maphistory";
                this.positions_search();            
             //   this.butons_simulation();
            },
            'click button#action_pause': function (e) {
                simulation_action="pause";
            },            
            'click button#action_stop': function (e) {
		        isimulacion=1;
		        simulation_action="stop";
            },            
            'click button#action_addpoint': function (e) {                        
                this.GeoMarker.push(coordinate);
                this.GeoMarker1.push(elocation);
                if(this.GeoMarker1.length>1)			
                {
                    this.puntos();
                    this.polilinea(this.GeoMarker1);
                }
            },            
        
        },        
        ////////////////////////////////////////////////
        async start() {
            await this._super(...arguments);
            //console.log("class_gpsmap.start");
            if (typeof google !== 'object' || typeof google.maps !== 'object') {
                await new Promise(resolve => {
                    this.trigger_up('gmap_api_request', {
                        editableMode: this.editableMode,
                        onSuccess: () => resolve(),
                    });
                });
                return;
            }          
            /*
			this.GeoMarker				=Array();
			this.GeoMarker1				=Array();     
			this.lineas					=Array();	      
            this.locationsMarker 		=new Array();              
            */
            this.map();
            this.status_device();
            this.position();
            this.status_device($("vehicle_active"));     
            this.giro(-50); 

            
            if(this.gpsmap_section=="gpsmaps_maphistory")
            {  
                
            }
            else
            {
                this.$("div#filtro").hide();
                this.$("div#buttons_history").hide();    
                this.status_device($("[vehicle='" + this.device_active + "']"));                                
            }            
        },
        giro: function(distancia) {
            if(this.device_active==0)            
            {
                distancia=distancia-0.15;   
                this.centerMap(this.LatLng({latitude:19,longitude:distancia}));                            
                setTimeout(function(){                   
                    self.giro(distancia)
                },40);
            }
        },            
/*
        start: function () {
            console.log("class_gpsmap.start");
            

            return this._super.apply(this, arguments);
        },
*/  
        status_device: function(obj)
        {	    	
            if(this.device_active==undefined)    this.device_active	=0;        

            if(obj!=undefined)
            {	            
                var latitude                =$(obj).attr("latitude");
                var longitude               =$(obj).attr("longitude");
                var ti                      =$(obj).attr("ti");
                var sp                      =$(obj).attr("sp");

                if(latitude!=undefined)
                {
                    //console.log("Pinta coordenadas");
                    var coordinates             ={"latitude":latitude,"longitude":longitude};
                    var position                = this.LatLng(coordinates);
                    this.map.panTo(position);
                }
                /*
                if(this.gpsmap_section!="gpsmaps_maphistory")
                {
                    this.status_device($("[vehicle='" + this.device_active + "']"));
                    
                }
                else
                {
                    this.status_device($("[vehicle='" + this.device_active + "']"));                                
                }
                */
            } 
               
            if(this.device_active==0)	
            {		 
                if($("div#odometro").length>0)
                {   
	                $("div#map_search").show();
	                $("div#odometro").hide();
	                $("div#tableros").hide();
	                $("#tablero").html("Estatus : Seleccionar un vehiculo");			
	                $("#tablero").animate({				
		                height: 25
	                }, 1000 );			
                }
            }	
            else
            {
	            this.map.setZoom(16);
                if($("div#odometro").length>0)
                {
                    $("div#maponline2").hide();
	                $("#tablero").animate({				
		                height: 58
	                }, 1000 );
	                //$("#tablero").html("<h4>" + ti + " Loading...</h4><img id=\"loader1\" src=\"icon=\"/gpsmap/static/src/img/loader1.gif\" height=\"20\" width=\"20\"/>");
	                $("#odometro").show();
	                $("#tableros").show();  
	                $("div#map_search").hide();
                }
            }	  			
        },

        ////////////////////////////////////////////////
        position: function(argument) {
            //console.log("POSITION ========");
            /*
            setTimeout(function()
            { 
            */ 
                if(argument==undefined)                 this.positions(argument);
                else if($("#data_tablero").length==0)   
                {
                    //console.log("tablero");
                    this.position(argument);         
                }    
            /*    
            },100);
            */
        },
        ////////////////////////////////////////////////
        positions: function(argument) {
			if(self.time==0)		self.time=7000;
			else if(self.time==7000)	this.time=14000;
			
            if(this.gpsmap_section!="gpsmaps_maphistory" && $("div#maponline").length>0)
            {            	 
                this.positions_search(argument);         
            }
            if(typeof argument!="number")
            {
            	console.log("tablero"+self.time);
                setTimeout(function()
                {            
                    self.positions(argument);
                },self.time);
            }
        },    
        ////////////////////////////////////////////////
        positions_search:function(argument){
            console.log("positions_search");
            var fields_select   =['deviceid','devicetime','latitude','longitude','speed_compu','attributes','address','event','status','course','phone'];
            var vehiculo_id;
            var vehiculos       =local.vehicles;
            var iresult;
            var method;
            var time;
            var ivehiculos;
            var model;
                        
            if(this.gpsmap_section=="gpsmaps_maphistory")
            {
                var start_time  =$("input#start").val();
                var end_time    =$("input#end").val();
                var filter    =$("li[class='type_report select']").attr("filter");
                                
                var option_args={
                    "domain":Array(),
                };

                option_args["domain"].push(["devicetime",">",start_time]);
                option_args["domain"].push(["devicetime","<",end_time]);                
                option_args["domain"].push(["type_report",">",filter]);

                //if(device_active!=0)                
                    option_args["domain"].push(["deviceid","=",this.device_active]);

                model={   
                    model:  "fleet.vehicle",
                    method: "js_positions_history",
                    args:[[],{"data":option_args,"fields": fields_select}],
                };                  

            }
            else
            {   
                model={   
                    model:  "fleet.vehicle",
                    method: "js_positions_online",
                    fields: fields_select
                };                
            }
            
            setTimeout(function()
            {
                if(vehiculos!= null && vehiculos.length>0)
                {	            
                    rpc.query(model)
                    .then(function (result) 
                    {
                        self.del_locations();
                        local.positions=Array();                          
                        {       
                            //console.log(result);                     	            
                            for(iresult in result)
                            {                            
                                var positions               =result[iresult];                                

                                var device                  =positions.deviceid;		                
                                var device_id               =positions["deviceid"];
            
                                if(typeof device_id!="number")
                                    var device_id           =positions["deviceid"][0];
                                    
                                if(local.positions[device_id]==undefined)
                                {
                                    local.positions[device_id]=Array();
                                }                                
                                positions.mo                ="";
                                positions.st                =1;
                                positions.te                =positions["phone"];
                                ////positions.dn                =vehiculo_name;
                                positions.ty                =positions["status"];
                                positions.na                ="name";
                                positions.de                =device_id;
                                positions.la                =positions["latitude"];
                                positions.lo                =positions["longitude"]; 
                                positions.co                =positions["course"]; 
                                //positions.mi                ="milage 2"; 
                                positions.sp                =positions["speed_compu"]; 
                                positions.ba                ="batery"; 
                                positions.ti                =positions["devicetime"]; 

                                positions.ho                ="icon_online"; 
                                positions.ad                =positions["address"]; 
                                positions.at                =positions["attributes"]; 
                                positions.im                =positions["image_vehicle"];     
                                positions.ev                =positions["event"]; 
                                positions.ge                ="geofence";
                                positions.ge                ="";  
                                positions.ni                ="nivel";

                                if(self.gpsmap_section=="gpsmaps_maphistory")   local.positions[device_id].push(positions);
                                else                                            local.positions[device_id][0]=positions;
                            }                                    
                        }
                        self.positions_paint(argument);                                                              
                    });
                }
            },50);
            
        },
        ////////////////////////////////////////////////
        positions_paint:function(argument)
        {       
        
            console.log("positions_paint");
            var ipositions;
            var iposition;
            if(local.positions.length>0)
            {                  
                //console.log(local.positions);
                var vehiculo_id;
                var vehiculos       =local.vehicles;
                var ivehiculos;
                for(ipositions in local.positions)
                {	
                    var positions       =local.positions[ipositions];
                    
                    //console.log(positions);
                    for(iposition in positions)
                    {	
                        var position    	=positions[iposition];                    
                        var device_id       =position.de; 
	                    if(vehiculos!= null && vehiculos.length>0)
	                    {	                    
	                        for(ivehiculos in vehiculos)
	                        {		                
	                            var vehiculo        =vehiculos[ivehiculos];		                
	                            
	                            if(vehiculo["gps1_id"][0]==device_id)
	                            {		                        
                                    var vehiculo_name   =vehiculo["economic_number"];
                                    var vehiculo_img    =vehiculo["image_vehicle"];

                                    var coordinates		={"latitude":position.latitude,"longitude":position.longitude};
                                    var posicion 		=this.LatLng(coordinates);
                                    coordinates["ti"]   =position.devicetime;
                                    coordinates["sp"]   =position.speed_compu;
                                    
                                    if($(".vehicle[vehicle='"+device_id+"'] ").length>0)                        
                                        $(".vehicle[vehicle='"+device_id+"']").attr(coordinates);
                                        
                                    vehiculo["de"]=device_id;
                                    vehiculo["dn"]=vehiculo_name;
                                    vehiculo["te"]=position.phone;
                                    vehiculo["la"]=position.latitude;
                                    vehiculo["lo"]=position.longitude;
                                    vehiculo["co"]=position.course;
                                    vehiculo["sp"]=position.speed_compu;
                                    vehiculo["ty"]=position.status;
//                                    vehiculo["mi"]=position.odometro;
                                    vehiculo["ev"]=position.event;
                                    vehiculo["ti"]=position.devicetime;
                                    vehiculo["im"]=vehiculo_img;
                                    vehiculo["at"]=position.attributes;
                                    
	                                this.locationsMap(vehiculo);            
	                                if(this.device_active==device_id) this.execute_streetMap(vehiculo);
                                }    
                            }
                        }
                    }                    
                }
            }
            else  console.log("SIN POSITIONES");
        },
        fn_localizaciones: function(position, vehiculo)
        {
        	var ivehiculo=vehiculo["de"];
		    if(localizaciones[ivehiculo]==undefined)     	
		    {
			    localizaciones[ivehiculo]	=Array(position);
			    if(vehiculo["se"]!="simulator")    	vehicle_data[ivehiculo]		=Array(vehiculo)
		    }	
		    else
		    {
			    localizaciones[ivehiculo].unshift(position);			
			    if(vehiculo["se"]!="simulator")     vehicle_data[ivehiculo].unshift(vehiculo)
		    }	
        },
        ////////////////////////////////////////////////
	    locationsMap: function(vehicle, type)
	    {
	        //.log("function locationsMap");
		    if(type==undefined)     type="icon";
		    else                    type="marker";

		    if(vehicle["st"]==undefined)	vehicle["st"]="1";
		    if(vehicle["st"]=="")			vehicle["st"]="1"; 
		    if(vehicle["mo"]=="map")		vehicle["st"]="1";
		    
		    //alert(vehicle["mo"]);
	        //alert(vehicle["st"]);		
		    if(vehicle["st"]=="1" || vehicle["st"]=="-1")
		    {
			    var device_id=vehicle["de"];
			    
			    if(localizacion_anterior==undefined)	
			    {
				    localizacion_anterior=new Array();				
				    localizacion_anterior[device_id]={ti:"2000-01-01 00:00:01"}			
			    }
			    if(localizacion_anterior[device_id]==undefined)	
			    {
				    localizacion_anterior[device_id]={ti:"2000-01-01 00:00:01"}			
			    }									
			    //if(vehicle["se"]=="historyMap" || vehicle["se"]=="historyForm" || vehicle["ti"] >= localizacion_anterior[device_id]["ti"])
			    //if(vehicle["se"]=="historyForm" || vehicle["ti"] >= localizacion_anterior[device_id]["ti"])
			    if(vehicle["ti"] >= localizacion_anterior[device_id]["ti"])
			    {
			        //alert("1");
				    //if(vehicle["ti"] > localizacion_anterior[device_id]["ti"] && vehicle["se"]!="simulator")
				    //hablar(vehicle);
				    localizacion_anterior[device_id]=vehicle;
			    
				    var coordinates			={latitude:vehicle["la"],longitude:vehicle["lo"]};
	    
				    $("table.select_devices[device="+ vehicle["de"] +"]")
					    .attr("lat", vehicle["la"])
					    .attr("lon", vehicle["lo"]);
					    
				    var icon_status="";	
				    if(vehicle["ty"]=="alarm")				                icon_status="sirena.png";
				    if(vehicle["ty"]=="Stopped")		                    icon_status="stop.png";
				    if(vehicle["ty"]=="Moving")		                        icon_status="car_signal1.png";
				    if(vehicle["ty"]=="Online")		                        icon_status="car_signal1.png";
				    if(vehicle["ty"]=="Offline")		
				    {
				        
					    icon_status="car_signal0.png";
					    if(vehicle["ho"]==1)	                            icon_status="car_signal1.png";
				    }	
				    if(vehicle["ty"]=="ignitionOn")			                icon_status="swich_on.png";
				    if(vehicle["ty"]=="ignitionOff")		                icon_status="swich_off.png";
				    
				    if(vehicle["sp"]<5 && vehicle["ty"]=="Online")	        icon_status="stop.png";
				    if(vehicle["sp"]>5 && vehicle["ty"]=="Online")	        icon_status="car_signal1.png";
				    
				    //console.log("function locationsMap" + vehicle);    
				    if(icon_status!="")
				    {				
				    	
					    var img_icon="<img width=\"20\" title=\""+ vehicle["ev"] +"\" src=\"/gpsmap/static/src/img/"+ icon_status +"\" >";					
				        if(vehicle["ty"]=="Offline")		
				        {
				            img_icon="<a href=\"tel:" + vehicle["te"] +"\">"+img_icon +"</a>";				        
				        }											
					    //$("table.select_devices[device_id="+ vehicle["de"] +"] tr td.event_device").html(img_icon);
					    //$("div.vehicle[device_id="+ vehicle["de"] +"] table tr td.event_device").html(img_icon);
					    $("div.vehicle[device_id="+ vehicle["de"] +"] table tr td.event_device").html(img_icon);
				    }	
							    
				    var icon        		=undefined;
				    
				    var posicion 		    = this.LatLng(coordinates);						    	
				    if(type=="icon")
				    {				    
					    var marcador;
					    if(vehicle["co"]==undefined)        vehicle["co"]	=1;
					    if(vehicle["co"])                   icon    		=vehicle["co"];
					    
					    if(icon>22 && icon<67)	icon=45;
					    else if(icon<112)		icon=90;
					    else if(icon<157)		icon=135;
					    else if(icon<202)		icon=180;
					    else if(icon<247)		icon=225;
					    else if(icon<292)		icon=270;
					    else if(icon<337)		icon=315;
					    else					icon=0;		

					    var image="01";
					    if(!(vehicle["im"]==undefined || vehicle["im"]==false))		image	=vehicle["im"];

					    //icon	="../sitio_web/img/car/vehiculo_" +image+ "/i"+icon+ ".png";		    
					    icon="/gpsmap/static/src/img/vehiculo_" +image+ "/i"+icon+ ".png";		    
					    if(labels[device_id]==undefined)	
					    {

						    labels[device_id]=new MapLabel({
							    text: 			vehicle["dn"],
							    position: 		posicion,
							    map: 			this.map,
							    fontSize: 		14,
							    fontColor:		"#8B0000",
							    align: 			"center",
							    strokeWeight:	5,
						    });
						    
					    }
					    //alert("2");
					    labels[device_id].set('position', posicion);
			    
					    //if(device_active==vehicle["de"] && vehicle["se"]==undefined || vehicle["se"]=="simulator" || vehicle["se"]=="historyForm") 
					    if(this.device_active==vehicle["de"] && vehicle["se"]==undefined || vehicle["se"]=="simulator")
					    {
					        // SI PASA EN EL HISTORICO
					        //alert("PASA 3");
					        this.centerMap(posicion);			
					        this.odometro(vehicle);
					    } 
				    }				
				    var marcador 		    = this.markerMap(posicion, icon);		
				    //var infowindow 		    = this.messageMap(marcador, vehicle);
				    
				    this.fn_localizaciones(marcador, vehicle);
			    }
			    else
			    {
				    //alert(vehicle["ti"] + ">"+ localizacion_anterior[device_id]["ti"]);
			    }					
		    }
		    else 
		    {
			    var marcador 		    =undefined;
			    
			    var tablero="<table><tr><td style=\"color:red;\"><b>Los vehiculos se encuentran bloqueados</b></td></tr><tr><td style=\"color:#fff;\">Favor de contactar con el administrador del sistema</td></tr></table>";	
        	    $("#tablero").html(tablero);			
		    }
		    return marcador;
	    },
	    ////////////////////////////////////////////////
        odometro: function (item)	 
        {    	
            //console.log("function odometro");
            if(item["at"]==undefined)                       item["at"]=new Array();
            else if(item["at"]["totalDistance"]==undefined) item["at"]= JSON.parse(item["at"]);
            
        
        	if(item["at"]["battery"]==undefined)			item["ba"]  =0;
        	else								            item["ba"]  =item["at"]["battery"];
        	if(item["al"]==undefined)						item["al"]  =0;
        	else					            			item["al"]  =item["al"];
        	
		    var gas;
            
        	if(item["at"]["totalDistance"]!=undefined)				
        	{
        	    var km = parseInt(parseInt(item["at"]["totalDistance"]) / 1000);
        	    	
        	    item["mi"]  					=km;    	    	
        	    if(item["odometer_unit"]=="miles")				
        	    {
        	        item["mi"]  				=km * 0.621371;    	    	
        	    }
        	}
        	
        	if(item["at"]["io3"]!=undefined)				
        	{
        		gas								=item["at"]["io3"];
        		//item["ga"]  					=parseInt(gas.substring(0,3));
        		item["ga"]  					=gas;    	    	
        	}	
        	else if(item["at"]["fuel"]!=undefined)
            {
        		gas								=item["at"]["fuel"];
        		//item["ga"]  					=parseInt(gas.substring(0,3));    	
        		item["ga"]  					=gas;    	    	
        	}
        	else if(item["at"]["fuel1"]!=undefined)
            {
        		gas								=item["at"]["fuel1"];
        		//item["ga"]  					=parseInt(gas.substring(0,3));
        		item["ga"]  					=gas;    	    	
        	}   
        	else								item["ga"]  =0;
        	
        	if(item["ba"]>100) item["ba"]=125;    
            var bat=item["ba"]*12/12.5-110;
            $("path.bateria").attr({"transform":"rotate("+ bat +" 250 250)"});            
            
            var vel=item["sp"]*12/10-110;  // 
            $("path.velocidad").attr({"transform":"rotate("+ vel +" 250 250)"});
            
            var alt=item["ga"]*12/10-38;
            $("path.altitude").attr({"transform":"rotate("+ alt +" 250 250)"});            

            $("#millas").html(item["mi"]);

            var tablero1="";
            var tablero2="";

		    ///*        
            if(item["st"]=="-1" && item["mo"]!="map")	//tiempo
            {
		        if(item["ni"]<=10)
	                tablero1= tablero1 + " :: EMPRESA PRE-BLOQUEADA :: ";
	            else
	            	alert("EMPRESA PRE-BLOQUEADA"); 
            }
            //*/
                            
            if(!(item["ti"]==undefined || item["ti"]==false || item["ti"]=="false"))	//tiempo
                tablero1= tablero1 + item["ti"];
            if(!(item["ge"]==undefined || item["ge"]==false || item["ge"]=="false"))        
                tablero1= tablero1 + " :: " + item["ge"];
      
            if(!(item["ev"]==undefined || item["ev"]==false || item["ev"]=="false"))	//evento
                tablero2= " :: " + item["ev"];
            
		    
            if(!(item["ad"]==undefined || item["ad"]==false || item["ad"]=="false"))       
                tablero2= "UBICACION :: " + item["ad"] + tablero2;          
                           
            if(item["ni"]<=40)
            {
			    var tablero="\
				    <table>\
					    <tr><td width=\"40\"  style=\"color:#fff;\"><a href=\"#\"onclick=\"command_device('Bloquear motor'," + item["de"] +")\"><img width=\"32\" src=\"../sitio_web/img/swich_off.png\"></a></td>\
					    <td style=\"color:#fff;\"><a href=\"tel:" + item["te"] +"\">" + tablero1 + "</a></td></tr>\
					    <tr><td width=\"40\"  style=\"color:#fff;\"><a href=\"#\"onclick=\"command_device('Activar motor'," + item["de"] +")\"><img width=\"32\" src=\"../sitio_web/img/swich_on.png\"></a></td>\
					    <td style=\"color:#fff;\">" +tablero2 + "</td></tr>\
				    </table>\
			    ";	
		    }
		    else
		    {	
			    var tablero="\
				    <table id=\"data_tablero\">\
					    <tr><td width=\"40\"  style=\"color:#fff;\"></td>\
					    <td style=\"color:#fff;\">" + tablero1 + "</td></tr>\
					    <tr><td width=\"40\"  style=\"color:#fff;\"></td>\
					    <td style=\"color:#fff;\">" +tablero2 + "</td></tr>\
				    </table>\
			    ";	
		    }	

			    var tablero="\
				    <table id=\"data_tablero\">\
					    <tr><td width=\"40\"  style=\"color:#fff;\"></td>\
					    <td style=\"color:#fff;\"><a href=\"tel:" + item["phone"] +"\"  style=\"color:#fff;\">" + tablero1 + "</a></td></tr>\
					    <tr><td width=\"40\"  style=\"color:#fff;\"></td>\
					    <td style=\"color:#fff;\">" +tablero2 + "</td></tr>\
				    </table>\
			    ";	


            $("#tablero").html(tablero);
        },	    
        ////////////////////////////////////////////////
	    markerMap: function(position, icon, markerOptions) 
	    {
            //console.log("function markerMap");	
		    if(markerOptions==undefined)	var markerOptions 			= new Object();
				    
		    markerOptions.position		=position;
		    markerOptions.map			=this.map;
		    if(icon!=undefined)
			    markerOptions.icon		=icon;
				    
		    //console.log("function markerMap" + this.map);	
		    var marker2=new google.maps.Marker(markerOptions);
     		return marker2
	    },
        
        ////////////////////////////////////////////////
        ////////////////////////////////////////////////
        
	    ////////////////////////////////////////////////
        centerMap: function(marcador)
	    {
		    this.map.panTo(marcador);		
	    },
        
        ////////////////////////////////////////////////
	    del_locations: function ()  
	    {		
	    	var idvehicle;	    
	    	var iposiciones;
            if(localizaciones.length>0)                
            {
                for(idvehicle in localizaciones)
                {
                    //if(simulation_action=="play")                               
                        var positions_vehicle			= localizaciones[idvehicle];                    
                    if(positions_vehicle.length>0)                
                    {
                        for(iposiciones in positions_vehicle)
                        {  
                            //if(iposiciones>0)
                            {	
                            	localizaciones[idvehicle][iposiciones].setVisible(false);								
                        		localizaciones[idvehicle][iposiciones].setMap(null);                     
                            	//if(iposiciones>0)	                        	localizaciones[idvehicle]=[]; 
                            } 	                    
                        }                    
                    }
                }
            }
	    },
	    ////////////////////////////////////////////////
	    execute_streetMap: function (vehicle)
	    {
		    if($("div#street").length>0)
		    {
			    var coordinates						={latitude:vehicle["la"],longitude:vehicle["lo"]};
		    
			    if(coordinate_active==undefined)	coordinate_active={};
			    var txt_active						=coordinate_active["latitude"]+","+coordinate_active["longitude"];
			    var txt_history						=coordinates["latitude"]+","+coordinates["longitude"];

			    var txt 							= txt_active + " " +txt_history;
		    
			    if(txt_active!=txt_history)
			    {	
				    coordinate_active				=coordinates;
				    var posicion					=this.LatLng(coordinates);
				    
				    this.centerMap(posicion);
				    var curso           			=vehicle["co"];		        
				    var panoramaOptions = {
				        position: posicion,
				        pov: {
				          heading:  curso,
				          pitch:    10
				        }
				    };
				    
				    var panorama = new google.maps.StreetViewPanorama(document.getElementById('street'), panoramaOptions);
				    this.map.setStreetView(panorama);	                		    
			    }        
		    }	
	    },

	    ////////////////////////////////////////////////
	    ////////////////////////////////////////////////
	    ////////////////////////////////////////////////
        paint_history: function(isimulacion) 
	    {	
	    	if(this.device_active>0)
	    	{		  
	            if(local.positions[this.device_active].length>isimulacion)                  
                {    
                	localizacion_anterior=undefined;
	            	var vehicle			=local.positions[this.device_active][isimulacion];	    		    	
	            		        		    	
	            	if(vehicle["sp"]>4)	
	            	{
	            		simulation_stop=0;
	            		simulation_time=600;
	            	}	
	            	else	
	            	{
				        if(simulation_stop<20)
				        {
					        simulation_stop=simulation_stop+1;
					        if(simulation_time==600)    simulation_time=300;
				        }	
				        else
				        {
					        if(simulation_time==300)	simulation_time=5;
				        }	
	            	}		        	
	            	vehicle["se"]		="simulator";
	            	this.locationsMap(vehicle);
	            	
	            	//if(section=="historyStreet")			execute_streetMap(vehicle);
                    setTimeout(function()
                    {   
                    	if(simulation_action!="pause")		                                            		    	
	                    	self.del_locations();
                    	isimulacion=isimulacion+1;

                    	if(simulation_action=="play")		
                    		self.paint_history(isimulacion);

                    },simulation_time);
                }
            }
	    },	    

        ////////////////////////////////////////////////
		vehicles_menu: function()  
		{
		    //console.log("class_gpsmap.vehicles_menu");		
		
	        var vehiculos       =local.vehicles;
	        var menu_vehiculo   ="";
	        var opcion_vehiculo ="";
	        var ivehiculos;
	        var icon;
	        var tipo;
	        		        
	        if(vehiculos!= null && vehiculos.length>0)
	        {		            
	            for(ivehiculos in vehiculos)
	            {		 		                               
	                var vehiculo        =vehiculos[ivehiculos];		                
	                
                    if(vehiculo["gps1_id"]!=undefined )
                    {          
                        var vehiculo_id     =vehiculo["gps1_id"][0];
                    }
                    var vehiculo_name   =vehiculo["name"].split("/");
                    vehiculo_name       =vehiculo_name[0];
                    
                    if(!(vehiculo["economic_number"]==undefined || vehiculo["economic_number"]==false))
                    {
                        vehiculo_name   = vehiculo["economic_number"];
                    }                        
                                                                        
		            var image="01";
		            if(!(vehiculo["image_vehicle"]==undefined || vehiculo["image_vehicle"]==false))
		            {
		                image=vehiculo["image_vehicle"];
		            }			
		            icon="/gpsmap/static/src/img/vehiculo_" +image+ "/i135.png";

	                opcion_vehiculo =opcion_vehiculo+"\
	                    <div class=\"vehicle\" position=\"\" latitude=\"\" longitude=\"\" device_id=\""+vehiculo_id+"\" vehicle=\""+vehiculo_id+"\" style=\"float:left; width:200px: display: block;\">\
		                    <table height=\"31\" width=\"195\" border=\"0\"  style=\"padding:5px;\" >\
	                        <tr>\
	                            <td height=\"100%\" width=\"40\" align=\"center\" valign=\"center\">\
	                                <img height=\"18\" src=\"" +icon+ "\">\
                                </td>\
	                            <td  height=\"100%\"><div style=\"position:relative; width:100%; height:100%;\">\
		                            <div style=\"   position:absolute; top:1px; left:0px; font-size:15px;\">" + vehiculo_name + "</div>\
    	                            <div style=\"position:absolute; top:16px; left:0px; font-size:9px;\"><b>"+ vehiculo["license_plate"] +"</b></div></td>\
	                            <td height=\"100%\" width=\"30\" align=\"center\" class=\"event_device\"> </td>\
                            </tr>\
                            </table>\
                        </div>\
                    ";
	            }         
	            $("div#menu_vehicle").html(opcion_vehiculo);  
	        }
		},
		limpiar_virtual: function ()
		{		
			var indexMarker;
			for(indexMarker=0; indexMarker< this.locationsMarker.length; indexMarker++)
			{
				this.locationsMarker[indexMarker].setMap(null);			
			}				
			this.locationsMarker.length = 0;		
			this.locationsMarker=Array();
		},
		limpiar_real: function ()
		{	

			this.limpiar_virtual();
			$("input#area").val("");		
			
			this.limpiar_lineas();			
			
			this.GeoMarker		=Array();
			this.GeoMarker1		=Array();
		},		
		limpiar_lineas: function ()
		{	
			var ilineas;			
			for(ilineas in this.lineas)
			{			
				this.lineas[ilineas].setMap(null);
			}
			this.lineas.length	=0;
			this.lineas			=Array();	
						
		},		

		puntos: function()
		{
			var index;
			var punto	=new String();
			var puntos	=new String();
			for(index in this.GeoMarker)
			{		
				punto	=this.GeoMarker[index];
				if(puntos=="")  puntos=punto["longitude"]+" "+punto["latitude"];
				else            puntos+=", "+punto["longitude"]+" "+punto["latitude"];			
			}
			puntos="POLYGON(("+puntos+"))";
			$("textarea[name='area']").val(puntos);
			return puntos;
		},	
		polilinea: function (LocationsLine,color)
		{	
			this.limpiar_lineas();
		
			var auxiliar=LocationsLine;

			var punto= this.GeoMarker1[this.GeoMarker1.length -1]			
			auxiliar.push(this.GeoMarker1[0]);
			auxiliar.push(punto);
						
			if(color==undefined)	var color="#FF0000";
			if(color=="") 			var color="#FF0000";

			var data_linea={
				path: auxiliar,
				geodesic: true,
				strokeColor: color,
				strokeOpacity: 1.0,
				strokeWeight: 2,
				map:this.map
			};

			this.lineas.push(new google.maps.Polyline(data_linea));
		}, 					
	    show_poligono: function (LocationsLine,option) 
	    {	
	        //console.log("###########SHOW POLYGON###############");           
		    if(option==undefined)			option={};
		    if(option.color==undefined)		option.color="#FF0000";		
		    if(option.color=="") 			option.color="#FF0000";
		    
		    if(option.opacity==undefined)	option.opacity=0.8;		
		    if(option.opacity=="") 			option.opacity=0.8;


			this.geofence 	= new google.maps.Polygon({
			    paths:          LocationsLine,
			    map:            this.map,
			    strokeColor:    option.color,
			    strokeOpacity:  option.color,
			    strokeWeight:   2,
			    fillColor:      option.color,
			    fillOpacity:    0.35
		    });


		    if(option.geofence!=undefined)
		    {
			    var total_lat   =0;
			    var total_lng   =0;
			    var may_lat     =0;
			    var may_lng     =0;
			    var iLocationsLine;
			    for(iLocationsLine in LocationsLine)
			    {	
				    if(LocationsLine[iLocationsLine].lat>may_lat)
				    { 
					    may_lat = LocationsLine[iLocationsLine].lat
					    may_lng = LocationsLine[iLocationsLine].lng
				    }	
				    total_lat   =total_lat + LocationsLine[iLocationsLine].lat;
				    total_lng   =total_lng + LocationsLine[iLocationsLine].lng;																						
			    }			    
			    may_lat         =may_lat - 0.00005;
			    
			    iLocationsLine	=parseInt(iLocationsLine)+1;
			    
			    var t_lat	    =(total_lat / (iLocationsLine));
			    var t_lng		=total_lng / (iLocationsLine);
			    
			    var posicion 	= this.LatLng({latitude:t_lat,longitude:t_lng});						    	
		        
			    var mapLabel = new MapLabel({
				    text: 			option.geofence,
				    position: 		posicion,
				    map: 			this.map,
				    fontSize: 		14,
				    fontColor:		"#000000",
				    align: 			"center",
				    strokeWeight:	5,
			    });
		    }			
		  
	    }, 	   
		poligon: function (elocation,color)
		{	
			console.log("poligon");
			
		    if (typeof this.geofence === 'object')
			{
				console.log("FUNCION POLIGON :: es objeto, limpia mapa objeto");
			    this.geofence.setMap(null);
			}			
			{
				//this.map.setZoom(16);
				this.map.panTo(elocation);
				
				var triangleCoords = [
					new google.maps.LatLng(parseFloat(elocation.lat()), 	parseFloat(elocation.lng())),
					new google.maps.LatLng(parseFloat(elocation.lat()-0.01), parseFloat(elocation.lng()-0.01)),
					new google.maps.LatLng(parseFloat(elocation.lat()-0.01), parseFloat(elocation.lng()+0.01))
				];	
				
				this.geofence.setOptions({
					paths:          triangleCoords,
					draggable:      true, // turn off if it gets annoying
					editable:       true,
					strokeColor:    '#FF0000',
					strokeOpacity:  0.8,
					strokeWeight:   2,
					fillColor:      '#FF0000',
					fillOpacity:    0.35,
					map:	        this.map		    	
				});
				
				//self = this;
			}
			//console.log("poligon=" + typeof this.geofence);
			if (typeof this.geofence === 'object')
			{
				globalThis.object_gpsmap = this;
				console.log("FUNCION POLIGON :: eventos");
				google.maps.event.addListener(globalThis.object_gpsmap.geofence.getPath(), "set_at", globalThis.object_gpsmap.getPolygonCoords);
				google.maps.event.addListener(globalThis.object_gpsmap.geofence.getPath(), "insert_at", globalThis.object_gpsmap.getPolygonCoords);			
			}
		}, 	
						
        foreach: function(objeto) 
        {
        	if (typeof objeto === 'object')
        	{        
        		var objeto_name=objeto.constructor.name;
				for (var index in objeto) 
				{	
					console.log(typeof objeto[index] + " " + objeto_name + "[" + index + "]");
								
					if (objeto.hasOwnProperty(index)) 
					{							
						console.log(objeto_name+ "[" + index + "]=" + objeto[index]);
					}					
					if (typeof objeto === 'object')
					{					
						this.foreach(objeto[index]);		
					}		
					
				} 
			}       	        	
		},
					
        getPolygonCoords: function() 
        {
        	console.log("getgeofenceCoords=" + globalThis.object_gpsmap.geofence.getPath());
		    //if (typeof this.geofence === 'object')
			{
                var puntos  = "";
                var punto;                        
                var len     = globalThis.object_gpsmap.geofence.getPath().getLength();
                
            	globalThis.object_gpsmap.foreach(globalThis.object_gpsmap.geofence.getPath().sd);    
                for (var i = 0; i < len; i++) 
                {                	
                    var punto   =globalThis.object_gpsmap.geofence.getPath().sd[i];
			        if(puntos=="")  puntos  =punto.lat()+" "+punto.lng();
			        else            puntos  +=", "+punto.lat()+" "+punto.lng();
                }
                punto=globalThis.object_gpsmap.geofence.getPath().sd[0];
                puntos+=", "+punto.lat()+" "+punto.lng();

				//console.log(puntos);
        		puntos="POLYGON(("+puntos+"))";
        		$("textarea[name='area']")
        		    .val(puntos)
                    .change();                    
			}
            //console.log("###########PUNTOS COORDENADAS###############");           
        },
        async geofences_paint()
        {
            //console.log("########### GEOFENCES PAINT ###############");
            
            var data={
                model:  "tc_geofences",
                method: "search_read",
                context: session.user_context,
            };
            
            this.geofences= this._rpc(data).then(function(res)   {  
                var igeofences;
                for(igeofences in res)
                {		                
                    var geofence                    =res[igeofences];		                               
                    var geofence_id                 =geofence["area"];
                    
                    if(geofence["hidden"]==false && geofence["area"]!=false)
                    {                                                    
                        var flightPlanCoordinates=self.array_points(geofence["area"]);                             
                        self.show_poligono(flightPlanCoordinates,{color:geofence["color"],geofence:geofence["name"]});	
                    } 
                }
            });            
        },        
	    array_points: function (points) 
	    {
	        var i_vec_points;
	        //console.log("###########ARRAY POINTS###############");
	        var array_points    =new Array();
            points              =points.substring(9, points.length - 2);   // Returns "ell" 	    
            var vec_points      =points.split(", ");
            
            //console.log(vec_points);
            for(i_vec_points in vec_points)
            {                   
                var point       =vec_points[i_vec_points];
                if(point!="")
                {                
                    var vec_point   =point.split(" ");	                   
                    var obj_point   ={lat:parseFloat(vec_point[0]),lng:parseFloat(vec_point[1])};
                    array_points.push(obj_point);
                }
            }        
            return array_points;
	    },
        		
        ////////////////////////////////////////////////
        async CreateMap(iZoom,iMap,coordinates,object) 
        {
            //console.log("class_gpsmap.CreateMap");
	        if(iMap=="ROADMAP")	            	var tMap = google.maps.MapTypeId.ROADMAP;
	        if(iMap=="HYBRID")	            	var tMap = google.maps.MapTypeId.HYBRID;								
	        var directionsService;	
	        
	        var position		            	=this.LatLng(coordinates);
	        var mapOptions 		            	= new Object();
    
	        if(iZoom!="")		            	mapOptions.zoom			=iZoom;
	        if(position!="")	            	mapOptions.center		=position;
	        if(iMap!="")		            	mapOptions.mapTypeId	=tMap;	            
	        
	        mapOptions.ScaleControlOptions		={position: google.maps.ControlPosition.TOP_RIGHT}
	        mapOptions.RotateControlOptions		={position: google.maps.ControlPosition.TOP_RIGHT}
	        mapOptions.zoomControlOptions		={position: google.maps.ControlPosition.TOP_LEFT};
	        mapOptions.streetViewControlOptions	={position: google.maps.ControlPosition.TOP_RIGHT}

            var mapC = $("#" + object);
	        this.map    				        = new google.maps.Map(mapC.get(0), mapOptions);        
	        this.geocoder 		   				= new google.maps.Geocoder();      
	        var trafficLayer 					= new google.maps.TrafficLayer();						
  			trafficLayer.setMap(this.map);
  			
  			
  			this.geofence 							= new google.maps.Polygon();
  			console.log("GENERA OBJETO GEOCERCA " + this.geofence);
  			
  					    
	        this.gMEvent                         	= google.maps.event;	
	        //object_gpsmap=this;		        			        			        
        },
        ////////////////////////////////////////////////
        async map(object) {        
        	/*
            this.locationsMarker 		=new Array();
			this.GeoMarker				=Array();
			this.GeoMarker1				=Array();        
			this.lineas					=Array();	  
			this.geofence;      
            */
            if(object==undefined)   object="maponline";
            
            //console.log("class_gpsmap.map :: " + object);
	        var iZoom               =2;
	        var iMap                ="HYBRID";  //ROADMAP
	        var coordinates         ={latitude:19.057522756727606,longitude:-104.29785901920393};
	        
	        if($("div#"+object).length>0)
                this.CreateMap(iZoom,iMap,coordinates,object);
        },

        ////////////////////////////////////////////////
	    LatLng: function (co)  
	    {
		    return new google.maps.LatLng(co.latitude,co.longitude);
	    }         
        ////////////////////////////////////////////////
        ////////////////////////////////////////////////
        ////////////////////////////////////////////////
        ////////////////////////////////////////////////

    });
    





    
    
   //////////////////////////////////////////////////////////////////////////////////////
   //////////////////////////////////////////////////////////////////////////////////////
   //////////////////////////////////////////////////////////////////////////////////////
    local.maponline = class_gpsmap.extend({
        template: 'gpsmaps_maponline',   
        willStart: function () {
            var retornar=this._super.apply(this, arguments);
            this.geofences_paint();
            this.positions();
            //console.log("maponline.willStart");            
            return retornar;
        },
    });   
    core.action_registry.add('gpsmap.maponline',local.maponline);
    //////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////
    local.streetonline = class_gpsmap.extend({
        template: 'gpsmaps_streetonline',   
        willStart: function () {
            var retornar=this._super.apply(this, arguments);
            this.geofences_paint();
            this.positions();
            //console.log("maponline.willStart");            
            return retornar;
        },
    });   
    core.action_registry.add('gpsmap.streetonline', local.streetonline);
    //////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////
    local.maphistory = class_gpsmap.extend({
        template: 'gpsmaps_maponline',

        start: function() {
            this.startTime();
                        
            this.gpsmap_section="gpsmaps_maphistory";
            return this._super.apply(this, arguments);
            //this.positions_online();
            //this.geofences_paint();
        },
        startTime: function() {
            var start_time= new Date().toISOString().slice(0,10) + " 07:00:00";            
            var end_time= new Date().toISOString().slice(0,10) + " 23:59:59";

            this.$("input#start").val(start_time);
            this.$("input#end").val(end_time);
        },                 
    });
    core.action_registry.add('gpsmap.maphistory', local.maphistory);
    
    return class_gpsmap;   
});
