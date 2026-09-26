'use strict';

const { z } = require('zod');
const authority = require('../services/growthAuthorityService');

async function status(req,res,next){
  try{res.setHeader('Cache-Control','no-store');return res.json(await authority.status());}
  catch(error){next(error);}
}

async function runNow(req,res,next){
  try{res.setHeader('Cache-Control','no-store');return res.json(await authority.run({autoEmail:false}));}
  catch(error){next(error);}
}

async function prospectAction(req,res,next){
  try{
    const params=z.object({id:z.string().trim().min(8).max(80)}).parse(req.params||{});
    const input=z.object({
      action:z.enum(['approve','dismiss','posted','sent','link_acquired','mention_acquired','ai_cited','metrics','no_response']),
      note:z.string().trim().max(700).optional(),
      publishedUrl:z.string().trim().url().max(1000).optional(),
      metrics:z.object({
        votes:z.coerce.number().int().min(0).max(100000000).optional(),
        replies:z.coerce.number().int().min(0).max(100000000).optional(),
        clicks:z.coerce.number().int().min(0).max(100000000).optional(),
        mentions:z.coerce.number().int().min(0).max(100000000).optional()
      }).optional()
    }).parse(req.body||{});
    res.setHeader('Cache-Control','no-store');
    return res.json(await authority.updateProspect(params.id,input.action,input));
  }catch(error){next(error);}
}

module.exports={status,runNow,prospectAction};
