# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import datetime
import requests
import random
from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _
class fuel(models.Model):
    _inherit = "fleet.vehicle.log.fuel"
class services(models.Model):
    _inherit = "fleet.vehicle.log.services"
class cost(models.Model):
    _inherit = "fleet.vehicle.cost"
class contract(models.Model):
    _inherit = "fleet.vehicle.log.contract"
class odometer(models.Model):
    _inherit = "fleet.vehicle.odometer"
class vehicle_model(models.Model):
    _inherit = "fleet.vehicle.model"
class vehicle_model_brand(models.Model):
    _inherit = "fleet.vehicle.model.brand"


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
    phone                                       = fields.Char('Phone', size=50)    
    economic_number                             = fields.Char('Economic Number', size=50)
    imei                                        = fields.Char('Imei', size=50)
    speed                                       = fields.Char('Exceso de Velocidad', default=100, size=3)   
    positionid                                  = fields.Many2one('gpsmap.positions',ondelete='set null', string="Position", index=True)
    motor                                       = fields.Boolean('Motor', default=True, track_visibility="onchange")
    def toggle_motor(self):
        print('TOOGLE--------------- MOTOR')          
            
class speed(models.Model):
    _name = "gpsmap.speed"
    _description = 'Positions Speed'
    _order = "starttime DESC"
    deviceid                                    = fields.Many2one('fleet.vehicle',ondelete='set null', string="Vehiculo", index=True)
    starttime                                   = fields.Datetime('Start Time')
    endtime                                     = fields.Datetime('End Time')
    speed                                       = fields.Float('Velocidad',digits=(3,2))

class positions(models.Model):
    _name = "gpsmap.positions"
    _description = 'GPS Positions'
    _order = "devicetime DESC"
    _pointOnVertex=""
    protocol                                    = fields.Char('Protocolo', size=15)
    deviceid                                    = fields.Many2one('fleet.vehicle',ondelete='set null', string="Vehiculo", index=True)
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
    leido                                       = fields.Integer('Leido',default=0)
    event                                       = fields.Char('Evento', size=70)
    def get_system_para(self):
        para_value                              =self.env['ir.config_parameter'].get_param('gpsmap_key','')
        return para_value
    def action_addpositions(self):
        self.run_scheduler()
        
    @api.model    
    def js_positions(self):
        vehicle_obj                             =self.env['fleet.vehicle']        
        vehicle_args                            =[]        
        return_positions                        ={}
        vehicle_data                            =vehicle_obj.search(vehicle_args, offset=0, limit=None, order=None)
        
        if len(vehicle_data)>0:         
            for vehicle in vehicle_data:
                positions_arg                   =[('deviceid','=',vehicle.id)]                
                positions_data                  =self.search_read(positions_arg, offset=0, limit=1, order='devicetime DESC')        
                if len(positions_data)>0:                            
                    return_positions[vehicle.id]    =positions_data[0]        
        return return_positions
    def run_scheduler_demo(self):
        positions_obj                           =self.env['gpsmap.positions']        
        vehicle_obj                             =self.env['fleet.vehicle']
        
        vehicle_args                            =[]
        vehicle_data                            =vehicle_obj.search(vehicle_args, offset=0, limit=None, order=None)

        now                                     =datetime.datetime.now()

        if len(vehicle_data)>0:         
            for vehicle in vehicle_data:
                positions_arg                   =[('deviceid','=',vehicle.id)]                
                positions_data                  =positions_obj.search(positions_arg, offset=0, limit=1, order='devicetime DESC')
                
                velocidad                       = random.randint(95, 130)
                curso                           = random.randint(30, 160)
                
                incremento_lat                  = random.uniform(-0.004, 0.004)
                
                latitude                        =positions_data[0].latitude + incremento_lat
                longitude                       =positions_data[0].longitude + 0.00345

                data_create={}        
                data_create['protocol']         ='tk103'
                data_create['deviceid']         =vehicle.id
                data_create['servertime']       =fields.Datetime.now()
                data_create['devicetime']       =fields.Datetime.now()
                data_create['fixtime']          =fields.Datetime.now()
                data_create['valid']            =''
                data_create['latitude']         =latitude
                data_create['longitude']        =longitude
                data_create['altitude']         =''
                data_create['speed']            =velocidad
                data_create['course']           =curso
                data_create['address']          =''
                data_create['attributes']       =''
                #data_create['other']            =0
                data_create['leido']            =''
                data_create['event']            =''
                
                positions_obj.create(data_create)    
        self.run_scheduler_get_position()
                
        #run_scheduler_get_position        
    def run_scheduler_get_position(self):
        now                                     = datetime.datetime.now()
        
        
        positions_obj                           =self.env['gpsmap.positions']
        vehicle_obj                             =self.env['fleet.vehicle']
        speed_obj                               =self.env['gpsmap.speed']
        mail_obj                                =self.env['mail.message']
        geofence_obj                            =self.env['gpsmap.geofence']
                
        alerts_data                             =geofence_obj.geofences()
        
        positions_arg                           =[('leido','=',0)]                
        positions_data                          =positions_obj.search(positions_arg, offset=0, limit=1000, order='devicetime DESC')        
        
        print('=============== READ POSITION ===================', len(positions_data))                        
        
        if len(positions_data)>0:         
            for position in positions_data:
                
                vehicle_arg                     =[('id','=',position.deviceid.id)]                
                vehicle                         =vehicle_obj.search(vehicle_arg)        
                if vehicle.speed=='':
                    vehicle.speed               =100
                if vehicle.speed==0:
                    vehicle.speed               =100    

                speed_arg                       =[['deviceid','=',position.deviceid.id],['endtime','=',False]]                
                speed_data                      =speed_obj.search(speed_arg, offset=0, limit=50000)        
                                
                
                
                if(vehicle.odometer_unit=="kilometers"):     ts=1.852
                if(vehicle.odometer_unit=="miles"):          ts=1.15
                else:                                        ts=1.852
                                                                
                                
                if float(vehicle.speed) < float(position.speed) * ts:
                    if(len(speed_data)==0):
                        speed                       ={}
                        speed["deviceid"]           =position.deviceid.id
                        speed["starttime"]          =position.devicetime
                        speed["speed"]              =position.speed
                        speed_obj.create(speed)
                        
                        mail                        ={}
                        mail["model"]               ="gpsmap.positions"        
                        mail["res_id"]              =position.id                        
                        mail["message_type"]        ="comment"                        
                        mail["body"]                ="Contenido del mensaje %s" %(vehicle.name) 
                        
                        #ail_obj.create(mail)        
                        print('Exceso de velocidad===================')
                        print(mail)
                                                
                else:
                    if(len(speed_data)>0):
                        speed                       ={}
                        for speed in speed_data:
                            speed["endtime"]        =position.devicetime
                            speed_obj.write(speed)                        
                            #print('Saliendo del exceso de velocidad')
                    #if len(speed_data)>0:
                                    
                if len(alerts_data)>0:                     
                    for alerts in alerts_data:
                        print('===========',alerts.name)
                        print('===========',alerts.device_ids)
                        print('===========',alerts.geofence_ids)                                
                                                        
                position["leido"]=1                
                positions_obj.write(position)
            
                    
            
            
                
class geofence(models.Model):
    _name = "gpsmap.geofence"
    _description = 'GPS Geofence'
    _pointOnVertex=""
    name = fields.Char('Name', size=75)
    description = fields.Char('Description', size=150)
    area = fields.Text('area')
    attributes = fields.Text('Attributes')
    points = fields.Text('Points')
    color = fields.Selection([
        ('green', 'Green'),
        ('red', 'Red'),
        ('blue', 'Blue'),
        ('black', 'Black'),
        ('grey', 'Grey'),
        ('yellow', 'Yellow'),
        ], 'Color', default='green', help='Color of geofence', required=True)
    hidden = fields.Boolean('Hidden')
    company_id = fields.Many2one('res.company', 'Company', required=True)
    
    def geofences(self):
        alerts_obj      =self.env['gpsmap.geofence_device']

        alerts_args    =[]
        alerts_data    =alerts_obj.search(alerts_args, offset=0, limit=None, order=None)

        #if len(alerts_data)>0:                     
            #for alerts in alerts_data:
            #    print('ALERT ====================',alerts.name)        
        
        return alerts_data
                
        
        
class geofence_device(models.Model):
    _name = "gpsmap.geofence_device"
    _description = 'GPS Geofence Device'
    _pointOnVertex=""
    name = fields.Char('Name', size=75)
    description = fields.Char('Description', size=150)
    mail_in = fields.Char('Mail In', size=150)
    mail_out = fields.Char('Mail Out', size=150)
    
    geofence_ids = fields.Many2many('gpsmap.geofence', 'alert_geofence', 'geofence_id', 'alert_id', string='Geofence')
    device_ids = fields.Many2many('fleet.vehicle', 'alert_device', 'device_id', 'alert_id', string='Device')            
