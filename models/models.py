# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import datetime, time, string
import requests, json
import random
import base64
from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _
import pytz
class fuel(models.Model):
    _inherit = "fleet.vehicle.log.fuel"
class services(models.Model):
    _inherit = "fleet.vehicle.log.services"
class cost(models.Model):
    _inherit = "fleet.vehicle.cost"
class contract(models.Model):
    _inherit = "fleet.vehicle.log.contract"
class vehicle_model(models.Model):
    _inherit = "fleet.vehicle.model"
class vehicle_model_brand(models.Model):
    _inherit = "fleet.vehicle.model.brand"

# CLONAR BD
# CREATE DATABASE traccar_developer WITH TEMPLATE traccar; 
# GRANT CONNECT ON DATABASE solesgps TO odoo;
# GRANT CONNECT ON DATABASE solesgps TO admin_evigra;

class odometer(models.Model):
    _inherit = "fleet.vehicle.odometer"
    _order = "date ASC"    
    activeTime                                       = fields.Float('Active Time',digits=(3,2))
    
    @api.model    
    def run_scheduler_set_odometer(self):    
        self.env.cr.execute("""
SELECT  vehicle_id,deviceid,date_trunc('day', fecha) as fecha,  ROUND(count(fecha)/60::numeric,2) as horas, round(max(distance)::numeric / 1000,3) as km
FROM ( 
	SELECT fv.id as vehicle_id, tp.deviceid, date_trunc('minute', tp.devicetime) as fecha,  max(tp.attributes::json->>'totalDistance') as distance
	FROM tc_positions tp JOIN fleet_vehicle fv on fv.gps1_id=tp.deviceid
	WHERE tp.attributes::json->>'motion'='true' AND tp.speed>2 	
	AND  date_trunc('day', now())=date_trunc('day', tp.devicetime)
	GROUP BY tp.deviceid, date_trunc('minute', tp.devicetime),fv.id
	ORDER BY date_trunc('minute', tp.devicetime) DESC
) tabla
GROUP BY vehicle_id,deviceid, date_trunc('day', fecha)
ORDER BY date_trunc('day', fecha) DESC       
""")
        positions                           =self.env.cr.dictfetchall()
        
        for position in positions:
            odometer_data                     ={}
            
            odometer_data["vehicle_id"]     =position["vehicle_id"]
            odometer_data["date"]           =position["fecha"]
            odometer_data["value"]          =position["km"]
            odometer_data["activeTime"]          =position["horas"]
            
            self.create(odometer_data)            
                
            #print("Device==",position["deviceid"]," fecha==",position["fecha"]," horas===",position["horas"]," km==",position["km"])

class tc_devices(models.Model):
    _name = "tc_devices"
    _description = 'traccar devices'
    _order = "name DESC"
        
    name                                        = fields.Char('Name', size=128, required=True)
    uniqueid                                    = fields.Char('IMEI', size=128, required=True)
    icc                                         = fields.Char('ICC', size=30)
    phone                                       = fields.Char('Phone', size=128)
    model                                       = fields.Char('Model', size=128)
    lastupdate                                  = fields.Datetime('Lastupdate')
    disabled                                    = fields.Boolean('Disable', default=False)
    signal                                      = fields.Boolean('Good signal', default=True)
    company_ids                                 = fields.Many2many('res.company', 'tcdevices_res_company_rel', 'user_id', 'cid', string='Companies', default=lambda self: self.env.user.company_id)
    
    
class tc_positions(models.Model):
    _name = "tc_positions"
    _description = 'traccar positions'
    _order = "devicetime DESC"
        
    protocol                                    = fields.Char('Protocolo', size=15)
    deviceid                                    = fields.Many2one('tc_devices',ondelete='set null', string="Vehiculo", index=True)
    servertime                                  = fields.Datetime('Server Time')
    devicetime                                  = fields.Datetime('Device Time')
    fixtime                                     = fields.Datetime('Error Time')
    valid                                       = fields.Integer('Valido')
    latitude                                    = fields.Float('Latitud',digits=(5,10))
    longitude                                   = fields.Float('Longitud',digits=(5,10))
    altitude                                    = fields.Float('Altura',digits=(6,2))
    speed                                       = fields.Float('Velocidad',digits=(3,2))
    course                                      = fields.Float('Curso',digits=(3,2))
    address                                     = fields.Char('Calle', size=150)
    attributes                                  = fields.Char('Atributos', size=5000)
    status                                      = fields.Char('Type', size=5000)

    
class vehicle(models.Model):
    _inherit = "fleet.vehicle"
    image_vehicle = fields.Selection([
        ('01', 'Gray Vehicle'),
        ('02', 'Red Vehicle'),
        ('03', 'Camioneta Gris'),
        ('04', 'Camioneta Gris'),
        ('05', 'White truck'),
        ('06', 'White van'),
        ('07', 'Blue van'),
        ('30', 'Moto'),
        ('90', 'Black Phone'),
        ('91', 'Blue  Phone'),
        ('92', 'Green Phone'),
        ('93', 'Red  Phone')
        ], 'Img GPS', default='01', help='Image of GPS Vehicle', required=True)
    temporal_id                                 = fields.Many2one('res.partner', 'temporal')
    #phone                                       = fields.Char('Phone', size=50)    
    economic_number                             = fields.Char('Economic Number', size=50)
    #imei                                        = fields.Char('Imei', size=50)
    speed                                       = fields.Char('Exceso de Velocidad', default=100, size=3)   
    #positionid                                  = fields.Many2one('gpsmap.positions',ondelete='set null', string="Position", index=True)
    positionid                                  = fields.Char('Position', size=50)
    motor                                       = fields.Boolean('Motor', default=True, track_visibility="onchange")
    #devicetime                                  = fields.Datetime('Device Time')
    #devicetime_compu                            = fields.Datetime('Device Time', compute='_get_date')
    
    gps1_id                                     = fields.Many2one('tc_devices',ondelete='set null', string="GPS", index=True)

    @api.one
    def _get_date(self):      
        if(self.devicetime != False):          
            tz = pytz.timezone(self.env.user.tz) if self.env.user.tz else pytz.utc                            
            self.devicetime_compu=tz.localize(fields.Datetime.from_string(self.devicetime)).astimezone(pytz.utc)
        else:    
            self.devicetime_compu=self.devicetime
    def toggle_motor(self):
        try:
            traccar_host                 =self.env['ir.config_parameter'].get_param('traccar_host','')
            devices_id                   =self.gps1_id["id"]
            
            if(self.motor==True):
                comando="engineStop"
            else:
                comando="engineResume"

            path="/api/commands/send"
            #url = "http://odoo.solesgps.com:8082/api/commands/send"
            url = "%s%s" %(traccar_host,path)
            payload = {
                "id"            :0,
                "description"   :"Nuevo...",
                "deviceId"      :devices_id,
                "type"          :comando,
                "textChannel"   :"false",
                "attributes"    :{}
            }                        
            
            ##headers = {	"Authorization": "Basic " + encoded		}
            headers                 = {	"Authorization": "Basic YWRtaW46YWRtaW4=","content-type": "application/json"}        

            req                     = requests.post(url, data=json.dumps(payload), headers=headers)
            req.raise_for_status()        
            json_traccar            = req.json()
            
            if(self.motor==True):
                self.motor=False
            else:
                self.motor=True                        
            
        except Exception:
            print("#####################################################")                
            print("Error al conectar con traccar")                
    @api.model    
    def cron_positions(self):
        print("EJECUTANDO CRON ####################################################################")
        return self.js_positions_online()
    @api.model    
    def js_positions_online(self):
        print("GEOCENFES IN POSITIONS ######################")        
        alerts_obj          =self.env['gpsmap.geofence_device']
        alerts_args         =[]
        alerts              =alerts_obj.search(alerts_args, offset=0, limit=None, order=None)

        for alert in alerts:            
            print("ALERTA ", alert["name"])        
            devices         =alert["device_ids"]
            geofences       =alert["geofence_ids"]
            polygons = []
            for geofence in geofences:
                area        =geofence["area"]                
                print("GEOFENCE", geofence["name"])
                str_area    =area[9:len(area)-2]
                print("AREA2 ", str_area)
                coordinates = str.split(str_area, ', ')
                polygon = []
                for coordinate in coordinates:
                    polygon.append(coordinate)                
                geofence.polygon=polygon                    
                polygons.append(geofence)


            data_devices	=[]
            data_device		=[]
            for device in devices:
                
            
            	print(device.name)
            	#data_device.device		=device
            	#data_device.geofences	=polygons
            	
            	#data_devices.append(data_device)
                #dev_id          =device["id"]
                #if(device["id"]==position["fv_id"]):
                #    print("VEHICULO VERIFICADO", device["name"])                   

        
                
        #geofence_ids = fields.Many2many('tc_geofences', 'alert_geofence', 'geofence_id', 'alert_id', string='Geofence')
        #device_ids = fields.Many2many('fleet.vehicle', 'alert_device', 'device_id', 'alert_id', string='Device')            
        
        print("POSITIONS ######################")
        
        hoy_fecha                               ="%s" %(datetime.datetime.now())
        hoy                                     =hoy_fecha[0:19]
    
        hoy_antes                               ="%s" %(datetime.datetime.now() - datetime.timedelta(minutes=5))        
        hoy_antes                               =hoy_antes[0:19]

        sql="""
            SELECT tp.*, tp.deviceid as tp_deviceid, td.phone, fv.odometer_unit, fv.speed as fv_speed, fv.id as fv_id,
                CASE 		                
                    WHEN fv.odometer_unit='kilometers'                          THEN 1.852 * tp.speed
                    WHEN fv.odometer_unit='miles'                               THEN 1.15 * tp.speed
                    ELSE 1.852 * tp.speed                    
                END	AS speed_compu,
                CASE 				            
	                WHEN tp.attributes::json->>'alarm'!=''                      THEN tp.attributes::json->>'alarm'
	                WHEN tp.attributes::json->>'motion'='false'                 THEN 'Stopped'
	                WHEN tp.attributes::json->>'motion'='true' AND tp.speed>2   THEN 'Moving'
	                ELSE 'Stopped'
                END	as event,                                 
                CASE 				            
                    WHEN tp.attributes::json->>'alarm'!=''                      THEN 'alarm'
                    WHEN now() between tp.devicetime - INTERVAL '15' MINUTE AND tp.devicetime + INTERVAL '15' MINUTE THEN 'Online'
                    ELSE 'Offline'
                END  as status                
            FROM  fleet_vehicle fv
                join tc_devices td on fv.gps1_id=td.id
                join tc_positions tp on td.positionid=tp.id
        """

        self.env.cr.execute(sql)
        return_positions                    ={}
        positions                           =self.env.cr.dictfetchall()
        for position in positions:
            print("status==",   position)
            if(position["status"]=="Offline"):
                print("Fuera de linea")
            else:
                if(float(position["fv_speed"]) < float(position["speed_compu"])):
                    print("Exceso de velocidad")
                for data_device in data_devices:
                    print("data_device", data_device)
                
            
            position["de"]            =position["tp_deviceid"]                            
            tp_deviceid               =position["tp_deviceid"]
            
            return_positions[tp_deviceid]    =position            
        return return_positions    
    @api.multi
    def js_positions_history(self,datas):		   
        start_time  =datas["data"]["domain"][0][2]
        end_time    =datas["data"]["domain"][1][2]       
        type_report =datas["data"]["domain"][2][2]
        deviceid    =datas["data"]["domain"][3][2]
    
        where_report=""
        
        if(type_report=="stop"):
            where_report="AND tp.speed<2"
        if(type_report=="alarm"):
            where_report="AND tp.attributes::json->>'alarm'!=''"
        if(type_report=="offline"):
            where_report="AND tp.devicetime + INTERVAL '3' MINUTE < tp.servertime"
        if(type_report=="alarm_PowerCut"):
            where_report="AND tp.attributes::json->>'alarm'='powerCut'"
        if(type_report=="alarm_PowerOff"):
            where_report="AND tp.attributes::json->>'alarm'='powerOff'"            
    
        sql="""
            SELECT tp.*, tp.deviceid as tp_deviceid, td.phone,
                CASE 		                
                    WHEN fv.odometer_unit='kilometers'                          THEN 1.852 * tp.speed
                    WHEN fv.odometer_unit='miles'                               THEN 1.15 * tp.speed
                    ELSE 1.852 * tp.speed                    
                END	AS speed_compu,
                CASE 				            
	                WHEN tp.attributes::json->>'alarm'!=''                      THEN tp.attributes::json->>'alarm'
	                WHEN tp.attributes::json->>'motion'='false'                 THEN 'Stopped'
	                WHEN tp.attributes::json->>'motion'='true' AND tp.speed>2   THEN 'Moving'
	                ELSE 'Stopped'
                END	as event,                                 
                CASE 				            
                    WHEN tp.attributes::json->>'alarm'!=''                      THEN 'alarm'
                    WHEN tp.devicetime + INTERVAL '3' MINUTE < tp.servertime    THEN 'Offline'
                    ELSE 'Online'
                END  as status, fv.image_vehicle
            FROM  fleet_vehicle fv
                join tc_devices td on fv.gps1_id=td.id
                join tc_positions tp on td.id=tp.deviceid
            WHERE  1=1          
                AND tp.devicetime>'%s'
                AND tp.devicetime<'%s'
                %s                 
        """ %(start_time,end_time,where_report)
        if int(deviceid)>0:
            sql="%s and td.id='%s' " %(sql,deviceid)
            
        sql="%s ORDER BY devicetime ASC" %(sql)    
                       
        self.env.cr.execute(sql)
        return_positions                    =[]
        positions                           =self.env.cr.dictfetchall()
        for position in positions:
            position["de"]            =position["tp_deviceid"]                            
            tp_deviceid               =position["tp_deviceid"]
                        
            return_positions.append(position)           
        return return_positions    

class route(models.Model):
    _name = "gpsmap.route"
    _description = 'GPS Route'
    name = fields.Char('Name', size=75)
    description = fields.Char('Description', size=150)
    area = fields.Text('area')
    attributes = fields.Text('Attributes')
    points = fields.Text('Points')
    hidden = fields.Boolean('Hidden')
    company_id = fields.Many2one('res.company', string='Company', default=lambda self: self.env.user.company_id, required=True)
    company_ids = fields.Many2many('res.company', 'route_res_company_rel', 'user_id', 'cid', string='Companies', default=lambda self: self.env.user.company_id)
        
class geofence_device(models.Model):
    _name = "gpsmap.geofence_device"
    _description = 'GPS Geofence Device'
    name = fields.Char('Name', size=75)
    description = fields.Char('Description', size=150)
    mail_in = fields.Char('Mail In', size=150)
    mail_out = fields.Char('Mail Out', size=150)    
    geofence_ids = fields.Many2many('tc_geofences', 'alert_geofence', 'geofence_id', 'alert_id', string='Geofence')
    device_ids = fields.Many2many('fleet.vehicle', 'alert_device', 'device_id', 'alert_id', string='Device')            
    company_id = fields.Many2one('res.company', string='Company', default=lambda self: self.env.user.company_id, required=True)
    company_ids = fields.Many2many('res.company', 'geofence_device_res_company_rel', 'user_id', 'cid', string='Companies', default=lambda self: self.env.user.company_id)
        
class tc_geofences(models.Model):
    _name = "tc_geofences"
    _description = 'GPS Geofence'
    
    name                = fields.Char('Name', size=75, required=True)
    description         = fields.Char('Description', size=150)
    area                = fields.Text('area')
    attributes          = fields.Text('Attributes')
    hidden              = fields.Boolean('Hidden') 
    distributor         = fields.Boolean('Distributor')  
    color = fields.Selection([
        ('green', 'Green'),
        ('red', 'Red'),
        ('blue', 'Blue'),
        ('black', 'Black'),
        ('grey', 'Grey'),
        ('yellow', 'Yellow'),
        ], 'Color', default='green', help='Color of geofence')
    
    company_ids = fields.Many2many('res.company', 'tc_geofences_res_company_rel', 'user_id', 'cid', string='Companies', default=lambda self: self.env.user.company_id)

    @api.model
    def create(self, vals):
        data=self.save(vals)
        rec = super(tc_geofences, self).create(data)
        return rec
    #@api.model
    def write(self, vals):  
        data=self.save(vals)      
        rec = super(tc_geofences, self).write(data)
        return rec
    #@api.model
    def save(self, vals):        
        vals["attributes"]={}
        if("color" in vals):                  
            vals["attributes"]["color"]=vals["color"]    
    
        vals["attributes"] = json.dumps(vals["attributes"])
    
        return vals
    
    def geofences(self):
        alerts_obj      =self.env['gpsmap.geofence_device']

        alerts_args    =[]
        alerts_data    =alerts_obj.search(alerts_args, offset=0, limit=None, order=None)

        #if len(alerts_data)>0:                     
            #for alerts in alerts_data:
            #    print('ALERT ====================',alerts.name)        
        
        return alerts_data

    def pointInPolygon(self, point, polygon, pointOnVertex=True):
        _pointOnVertex = pointOnVertex
        point = self.pointStringToCoordinates(self, point)

        vertices = []
        for vertex in polygon:
            vertices.append(self.pointStringToCoordinates(self, vertex))

        intersections = 0
        for i in range(len(vertices)):

            vertex1 = vertices[i - 1]
            vertex2 = vertices[i]
            if float(vertex1['y']) == float(vertex2['y']) and float(vertex1['y']) == float(point['y']) and float(
                    point['x']) > min(float(vertex1['x']), float(vertex2['x'])) and float(point['x']) < max(
                    float(vertex1['x']), float(vertex2['x'])):
                return 'BORDE'

            if float(point['y']) > min(float(vertex1['y']), float(vertex2['y'])) and float(point['y']) <= max(
                    float(vertex1['y']), float(vertex2['y'])) and float(point['x']) <= max(float(vertex1['x']), float(
                    vertex2['x'])) and float(vertex1['y']) != float(vertex2['y']):
                xinters = (float(point['y']) - float(vertex1['y'])) * (float(vertex2['x']) - float(vertex1['x'])) / (
                            float(vertex2['y']) - float(vertex1['y'])) + float(vertex1['x'])
                if xinters == float(point['x']):
                    return 'BORDE'
                if float(vertex1['x']) == float(vertex2['x']) or float(point['x']) <= float(xinters):
                    intersections = intersections + 1

        if intersections % 2 != 0:
            return 'IN'
        else:
            return 'OUT'

    def pointStringToCoordinates(self, point):
        coordinates = str.split(point, ' ')
        coordinate = {}
        coordinate['x'] = coordinates[0]
        coordinate['y'] = coordinates[1]
        return coordinate
