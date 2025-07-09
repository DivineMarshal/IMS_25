import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { query } from '../../../app/lib/db';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Get facultyId from query or session (for now, from query)
    const facultyId = req.query.facultyId;
    if (!facultyId) {
      return res.status(400).json({ success: false, message: 'Faculty ID is required' });
    }
    try {
      const awards = await query(
        `SELECT award_id, faculty_id, award_name, awarding_organization as organization, award_description, award_date as date, category, certificate FROM faculty_awards WHERE faculty_id = ? ORDER BY award_date DESC`,
        [facultyId]
      );
      return res.status(200).json({ success: true, data: awards });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to fetch awards', error: String(error) });
    }
  }

  if (req.method === 'POST') {
    // Parse form data
    const form = new IncomingForm({
      multiples: false,
      uploadDir: path.join(process.cwd(), 'public/uploads/certificates'),
      keepExtensions: true,
      maxFileSize: 30 * 1024 * 1024, // 30MB
      filter: ({ mimetype }) => mimetype && mimetype === 'application/pdf',
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(400).json({ success: false, message: 'File upload error', error: String(err) });
      }
      const award_name = Array.isArray(fields.award_name) ? fields.award_name[0] : fields.award_name;
      const awarding_organization = Array.isArray(fields.awarding_organization) ? fields.awarding_organization[0] : fields.awarding_organization;
      const award_description = Array.isArray(fields.award_description) ? fields.award_description[0] : fields.award_description;
      const award_date = Array.isArray(fields.award_date) ? fields.award_date[0] : fields.award_date;
      const category = Array.isArray(fields.category) ? fields.category[0] : fields.category;
      let certificatePath = null;
      if (files.certificate) {
        const file = Array.isArray(files.certificate) ? files.certificate[0] : files.certificate;
        const fileName = file && file.filepath ? path.basename(file.filepath) : null;
        certificatePath = fileName ? `/uploads/certificates/${fileName}` : null;
      }
      // Validate required fields
      if (!award_name || !awarding_organization || !award_date) {
        return res.status(400).json({
          success: false,
          message: 'Title, awarding organization, and date are required',
        });
      }
      // Get facultyId from fields or session (for now, just from fields)
      const facultyId = Array.isArray(fields.facultyId) ? fields.facultyId[0] : fields.facultyId;
      if (!facultyId) {
        return res.status(400).json({ success: false, message: 'Faculty ID is required' });
      }
      try {
        // Insert the award (with certificate)
        const result = await query(
          `INSERT INTO faculty_awards 
            (faculty_id, award_name, awarding_organization, award_description, award_date, category, certificate) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            facultyId,
            award_name,
            awarding_organization,
            award_description || null,
            award_date,
            category,
            certificatePath,
          ]
        );
        return res.status(200).json({
          success: true,
          message: 'Award added successfully',
          data: {
            award_id: result.insertId,
            faculty_id: facultyId,
            award_name,
            organization: awarding_organization,
            award_description,
            date: award_date,
            category,
            certificate: certificatePath,
          },
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Failed to add award',
          error: String(error),
        });
      }
    });
    return;
  }

  if (req.method === 'PUT') {
    const { awardId } = req.query;
    if (!awardId) {
      return res.status(400).json({ success: false, message: 'Award ID is required' });
    }
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload with formidable
      const { IncomingForm } = require('formidable');
      const fs = require('fs');
      const path = require('path');
      const form = new IncomingForm({
        multiples: false,
        uploadDir: path.join(process.cwd(), 'public/uploads/certificates'),
        keepExtensions: true,
        maxFileSize: 30 * 1024 * 1024, // 30MB
        filter: ({ mimetype }) => mimetype && mimetype === 'application/pdf',
      });
      form.parse(req, async (err, fields, files) => {
        if (err) {
          return res.status(400).json({ success: false, message: 'File upload error', error: String(err) });
        }
        const award_name = Array.isArray(fields.award_name) ? fields.award_name[0] : fields.award_name;
        const awarding_organization = Array.isArray(fields.awarding_organization) ? fields.awarding_organization[0] : fields.awarding_organization;
        const award_description = Array.isArray(fields.award_description) ? fields.award_description[0] : fields.award_description;
        const award_date = Array.isArray(fields.award_date) ? fields.award_date[0] : fields.award_date;
        const category = Array.isArray(fields.category) ? fields.category[0] : fields.category;
        let certificatePath = null;
        if (files.certificate) {
          const file = Array.isArray(files.certificate) ? files.certificate[0] : files.certificate;
          const fileName = file && file.filepath ? path.basename(file.filepath) : null;
          certificatePath = fileName ? `/uploads/certificates/${fileName}` : null;
        }
        try {
          // If a new certificate is uploaded, update it; otherwise, keep the old one
          let updateSql = `UPDATE faculty_awards SET award_name = ?, awarding_organization = ?, award_description = ?, award_date = ?, category = ?`;
          let params = [award_name, awarding_organization, award_description || null, award_date, category];
          if (certificatePath) {
            updateSql += `, certificate = ?`;
            params.push(certificatePath);
          }
          updateSql += ` WHERE award_id = ?`;
          params.push(awardId);
          await query(updateSql, params);
          return res.status(200).json({ success: true, message: 'Award updated successfully' });
        } catch (error) {
          return res.status(500).json({ success: false, message: 'Failed to update award', error: String(error) });
        }
      });
      return;
    } else {
      // Handle JSON body (no file upload)
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => { body += chunk; });
        req.on('end', resolve);
        req.on('error', reject);
      });
      body = JSON.parse(body);
      const { award_name, awarding_organization, award_description, award_date, category } = body;
      try {
        await query(
          `UPDATE faculty_awards SET award_name = ?, awarding_organization = ?, award_description = ?, award_date = ?, category = ? WHERE award_id = ?`,
          [award_name, awarding_organization, award_description || null, award_date, category, awardId]
        );
        return res.status(200).json({ success: true, message: 'Award updated successfully' });
      } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to update award', error: String(error) });
      }
    }
  }

  if (req.method === 'DELETE') {
    const { awardId } = req.query;
    if (!awardId) {
      return res.status(400).json({ success: false, message: 'Award ID is required' });
    }
    try {
      await query('DELETE FROM faculty_awards WHERE award_id = ?', [awardId]);
      return res.status(200).json({ success: true, message: 'Award deleted successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to delete award', error: String(error) });
    }
  }

  // Method not allowed
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
} 